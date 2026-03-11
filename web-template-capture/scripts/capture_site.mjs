import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function loadChromium() {
  try {
    const playwright = await import("playwright");
    return playwright.chromium;
  } catch {
    throw new Error("Playwright is not installed. Run `npm install` and `npx playwright install chromium` inside web-template-capture.");
  }
}

async function launchPersistentBrowser(chromium, profileDir) {
  const baseOptions = {
    headless: false,
    viewport: { width: 1440, height: 960 },
    args: ["--disable-blink-features=AutomationControlled"]
  };

  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      ...baseOptions,
      channel: "chrome"
    });
    console.log("Browser runtime: Chrome");
    return context;
  } catch (chromeError) {
    console.warn(`Chrome launch failed, falling back to Playwright Chromium: ${chromeError.message.split("\n")[0]}`);
  }

  try {
    const context = await chromium.launchPersistentContext(profileDir, baseOptions);
    console.log("Browser runtime: Playwright Chromium");
    return context;
  } catch (chromiumError) {
    throw new Error(
      `Unable to launch a browser. Run \`npx playwright install chromium\` or install Google Chrome locally. Last error: ${chromiumError.message.split("\n")[0]}`
    );
  }
}

const CLICKABLE_SELECTOR = 'button, a[href], [role="button"], [role="tab"], [aria-controls], [data-testid]';
const DANGEROUS_TERMS = [
  "logout",
  "log out",
  "sign out",
  "delete",
  "remove",
  "withdraw",
  "close account",
  "disable",
  "deactivate",
  "api management",
  "save",
  "submit",
  "confirm",
  "pay"
];
const SAFE_DISCOVERY_TERMS = [
  "more",
  "details",
  "detail",
  "overview",
  "email",
  "emails",
  "account",
  "preferences",
  "privacy",
  "sign in",
  "security",
  "tab",
  "expand",
  "show",
  "view",
  "history",
  "fee",
  "vip",
  "volume",
  "trade",
  "trading",
  "30d",
  "30 days",
  "30-day",
  "volume",
  "fee tier"
];
const LOGIN_URL_PATTERNS = [
  /\/login\b/i,
  /\/signin\b/i,
  /authcenter/i,
  /accounts\./i
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 120);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractWordTokens(value) {
  return unique((String(value || "").match(/[\p{L}\p{N}_-]+/gu) || []).map((token) => token.toLowerCase()));
}

function buildTargetProfile({ fieldName = "", targetKeywords = "", navigationHint = "", hintValue = "" }) {
  const phrases = [];
  const tokens = [];

  const rawValues = [fieldName, targetKeywords, navigationHint, hintValue].filter(Boolean);
  for (const rawValue of rawValues) {
    const parts = String(rawValue)
      .split(/[,\n|]/)
      .map((part) => part.trim())
      .filter(Boolean);
    phrases.push(...parts.map(normalizeText));
    tokens.push(...parts.flatMap(extractWordTokens));
  }

  const field = String(fieldName);
  if (/volume|trading volume|trade volume|turnover/i.test(field)) {
    phrases.push("trading volume", "trade volume", "30-day", "last 30 days");
    tokens.push("volume", "trading", "trade", "turnover", "30d", "30-day", "btc");
  }
  if (/fee|vip|level|tier/i.test(field) || /fee|vip|level|tier/i.test(navigationHint)) {
    phrases.push("vip", "fee tier", "trading fee level");
    tokens.push("vip", "fee", "level", "tier", "maker", "taker");
  }
  if (/(30d|30 day|30-day|30 days|last 30 days)/i.test(field) || /(30d|30 day|30-day|30 days|last 30 days)/i.test(navigationHint)) {
    phrases.push("30d", "30-day", "30 days", "last 30 days");
    tokens.push("30d", "30-day", "30", "days");
  }

  return {
    field_name: fieldName,
    hint_value: hintValue || null,
    phrases: unique(phrases.map(normalizeText)),
    tokens: unique(tokens.map(normalizeText))
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function extractOperationName(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.includes("graphql") && parts.length >= 2) {
      return parts.at(-1);
    }
    return parts.at(-1) || parsed.hostname;
  } catch {
    return "unknown";
  }
}

function isLikelyLoginUrl(value) {
  const url = String(value || "");
  return LOGIN_URL_PATTERNS.some((pattern) => pattern.test(url));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteUrl = args["site-url"];
  if (!siteUrl) {
    throw new Error("Missing required --site-url");
  }

  const parsedSiteUrl = new URL(siteUrl);
  const siteSlug = slugify(parsedSiteUrl.hostname);
  const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
  const outputRoot = args["output-root"] || path.join(os.homedir(), ".web-template-capture", "artifacts");
  const sessionDir = path.join(outputRoot, siteSlug, sessionId);
  const responsesDir = path.join(sessionDir, "responses");
  const domDir = path.join(sessionDir, "dom");
  const profileDir = args["profile-dir"] || path.join(os.homedir(), ".codex-playwright", "web-template-capture", siteSlug);
  const autoCloseMs = args["auto-close-ms"] ? Number(args["auto-close-ms"]) : null;
  const loginWaitMs = args["login-wait-ms"] ? Number(args["login-wait-ms"]) : 10 * 60 * 1000;
  const manualCapture = Boolean(args["manual-capture"]);
  const autoExplore = !manualCapture;
  const maxClicks = args["max-clicks"] ? Number(args["max-clicks"]) : 8;
  const settleMs = args["settle-ms"] ? Number(args["settle-ms"]) : 2500;
  const targetFieldName = args["target-field-name"] || "";
  const targetKeywords = args["target-keywords"] || "";
  const targetHintValue = args["target-hint-value"] || "";
  const navigationHint = args["navigation-hint"] || (
    autoExplore
      ? "Log in if needed, then wait. The script will continue exploring automatically and close the browser when it finishes."
      : "Log in if needed, navigate to the page containing the target field, then close the browser window."
  );
  const targetProfile = buildTargetProfile({
    fieldName: targetFieldName,
    targetKeywords,
    navigationHint,
    hintValue: targetHintValue
  });

  await ensureDir(responsesDir);
  await ensureDir(domDir);

  const session = {
    site_url: siteUrl,
    site_slug: siteSlug,
    session_id: sessionId,
    navigation_hint: navigationHint,
    started_at: new Date().toISOString(),
    target: targetProfile,
    page_urls: [],
    response_count: 0,
    dom_snapshots: [],
    interactions: []
  };

  console.log("Opening a persistent Chrome window for capture.");
  console.log(`Site: ${siteUrl}`);
  console.log(`Navigation hint: ${navigationHint}`);
  if (targetProfile.phrases.length > 0 || targetProfile.tokens.length > 0) {
    console.log(`Target phrases: ${targetProfile.phrases.join(", ") || "(none)"}`);
  }
  if (autoExplore) {
    console.log(`Auto-explore enabled by default. Max clicks: ${maxClicks}. Settle time: ${settleMs} ms.`);
  }
  if (autoExplore) {
    console.log(`Login wait timeout: ${loginWaitMs} ms.`);
  }
  if (autoCloseMs) {
    console.log(`The browser will auto-close after ${autoCloseMs} ms.`);
  } else if (autoExplore) {
    console.log("The browser will close automatically after click exploration finishes.");
  } else {
    console.log("Close the browser window when the target page is fully loaded.");
  }
  console.log(`Session directory: ${sessionDir}`);

  const chromium = await loadChromium();
  const context = await launchPersistentBrowser(chromium, profileDir);
  const page = context.pages()[0] ?? (await context.newPage());
  let contextClosed = false;
  context.on("close", () => {
    contextClosed = true;
  });

  let responseCounter = 0;
  let snapshotCounter = 0;
  const seenPageUrls = new Set();
  let activeInteraction = null;
  const responseEntries = [];

  function scoreTextAgainstTarget(value) {
    const text = normalizeText(value);
    if (!text) {
      return { score: 0, reasons: [] };
    }

    let score = 0;
    const reasons = [];
    for (const phrase of targetProfile.phrases) {
      if (phrase && text.includes(phrase)) {
        score += 28;
        reasons.push(`text contains ${phrase}`);
      }
    }
    for (const token of targetProfile.tokens) {
      if (!token) {
        continue;
      }
      if (text === token) {
        score += 20;
        reasons.push(`text matches ${token}`);
      } else if (text.includes(token)) {
        score += 8;
        reasons.push(`text contains ${token}`);
      }
    }
    return { score, reasons };
  }

  function scoreClickCandidate(candidate) {
    const fields = [candidate.text, candidate.ariaLabel, candidate.href, candidate.contextText, candidate.title, candidate.dataTestId];
    let score = 0;
    const reasons = [];

    for (const field of fields) {
      const fieldScore = scoreTextAgainstTarget(field);
      score += fieldScore.score;
      reasons.push(...fieldScore.reasons);
    }

    const fingerprint = normalizeText(fields.join(" "));
    if (!fingerprint) {
      score -= 20;
      reasons.push("no meaningful label");
    }

    if (candidate.role === "tab") {
      score += 8;
      reasons.push("tab-like control");
    }
    if (candidate.tag === "button") {
      score += 4;
      reasons.push("button control");
    }
    if (candidate.href && candidate.href.startsWith("#")) {
      score += 6;
      reasons.push("same-page anchor");
    }
    if (candidate.ariaControls) {
      score += 10;
      reasons.push("controls expandable content");
    }
    if (SAFE_DISCOVERY_TERMS.some((term) => fingerprint.includes(term))) {
      score += 6;
      reasons.push("safe discovery wording");
    }
    if (candidate.text.length > 100) {
      score -= 8;
      reasons.push("label too long");
    }
    if (DANGEROUS_TERMS.some((term) => fingerprint.includes(term))) {
      score -= 100;
      reasons.push("dangerous action");
    }

    return {
      score,
      reasons: unique(reasons)
    };
  }

  async function listClickableCandidates() {
    const rawCandidates = await page.evaluate((selector) => {
      const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const buildSelector = (element) => {
        if (!(element instanceof HTMLElement)) {
          return null;
        }
        if (element.id) {
          return `#${CSS.escape(element.id)}`;
        }
        const dataTestId = element.getAttribute("data-testid");
        if (dataTestId) {
          return `[data-testid="${CSS.escape(dataTestId)}"]`;
        }
        if (element instanceof HTMLAnchorElement && element.getAttribute("href")) {
          return `a[href="${CSS.escape(element.getAttribute("href"))}"]`;
        }

        const parts = [];
        let current = element;
        while (current && current.tagName && current !== document.body) {
          const tag = current.tagName.toLowerCase();
          const parent = current.parentElement;
          if (!parent) {
            break;
          }
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}:nth-of-type(${index})`);
          current = parent;
        }
        return parts.length > 0 ? parts.join(" > ") : null;
      };

      const seen = new Set();
      const candidates = [];
      const nodes = Array.from(document.querySelectorAll(selector));
      nodes.forEach((element) => {
        if (!(element instanceof HTMLElement) || !isVisible(element)) {
          return;
        }
        const text = clean(element.innerText || element.textContent || "");
        const ariaLabel = clean(element.getAttribute("aria-label"));
        const title = clean(element.getAttribute("title"));
        const href = element instanceof HTMLAnchorElement ? element.href : "";
        const tag = element.tagName.toLowerCase();
        const role = clean(element.getAttribute("role"));
        const dataTestId = clean(element.getAttribute("data-testid"));
        const ariaControls = clean(element.getAttribute("aria-controls"));
        const contextRoot = element.closest("section, article, [role=tabpanel], [role=dialog], .card, [class*=card], [class*=panel]") || element.parentElement;
        const contextText = clean(contextRoot?.innerText || "").slice(0, 220);
        const selectorValue = buildSelector(element);
        const dedupeKey = [tag, role, text, ariaLabel, href, dataTestId, selectorValue].join("|");

        if (seen.has(dedupeKey)) {
          return;
        }
        if (!selectorValue) {
          return;
        }
        if (!text && !ariaLabel && !title && !href && !dataTestId) {
          return;
        }

        seen.add(dedupeKey);
        candidates.push({
          selector: selectorValue,
          text,
          ariaLabel,
          title,
          href,
          tag,
          role,
          dataTestId,
          ariaControls,
          contextText
        });
      });
      return candidates;
    }, CLICKABLE_SELECTOR);

    return rawCandidates
      .map((candidate) => ({
        ...candidate,
        ...scoreClickCandidate(candidate)
      }))
      .sort((left, right) => right.score - left.score);
  }

  async function listDomCatalog() {
    return page.evaluate(() => {
      const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const buildSelector = (element) => {
        if (!(element instanceof HTMLElement)) {
          return null;
        }
        if (element.id) {
          return `#${CSS.escape(element.id)}`;
        }
        const dataTestId = element.getAttribute("data-testid");
        if (dataTestId) {
          return `[data-testid="${CSS.escape(dataTestId)}"]`;
        }
        if (element instanceof HTMLAnchorElement && element.getAttribute("href")) {
          return `a[href="${CSS.escape(element.getAttribute("href"))}"]`;
        }

        const parts = [];
        let current = element;
        while (current && current.tagName && current !== document.body) {
          const tag = current.tagName.toLowerCase();
          const parent = current.parentElement;
          if (!parent) {
            break;
          }
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}:nth-of-type(${index})`);
          current = parent;
        }
        return parts.length > 0 ? parts.join(" > ") : null;
      };
      const buildXPath = (element) => {
        if (!(element instanceof Element)) {
          return null;
        }
        if (element.id) {
          return `//*[@id=${JSON.stringify(element.id)}]`;
        }
        const segments = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const tag = current.tagName.toLowerCase();
          const parent = current.parentElement;
          if (!parent) {
            segments.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          const index = siblings.indexOf(current) + 1;
          segments.unshift(`${tag}[${index}]`);
          current = parent;
        }
        return `/${segments.join("/")}`;
      };
      const xpathPattern = (xpath) => String(xpath || "").replace(/\[\d+\]/g, "[*]");
      const hasMeaningfulChild = (element) => Array.from(element.children).some((child) => {
        if (!(child instanceof HTMLElement) || !isVisible(child)) {
          return false;
        }
        return clean(child.innerText || child.textContent || "").length > 0;
      });

      const selector = [
        "a[href]",
        "button",
        "[role='button']",
        "[role='tab']",
        "[aria-label]",
        "h1",
        "h2",
        "h3",
        "h4",
        "li",
        "[role='listitem']",
        "td",
        "th",
        "dt",
        "dd",
        "p",
        "span",
        "div"
      ].join(", ");

      const seen = new Set();
      const entries = [];
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const element of nodes) {
        if (!(element instanceof HTMLElement) || !isVisible(element)) {
          continue;
        }

        const tag = element.tagName.toLowerCase();
        const text = clean(element.innerText || element.textContent || "");
        const href = element instanceof HTMLAnchorElement ? element.href : "";
        const ariaLabel = clean(element.getAttribute("aria-label"));
        const title = clean(element.getAttribute("title"));
        const role = clean(element.getAttribute("role"));
        const dataViewName = clean(element.getAttribute("data-view-name"));
        const dataTestId = clean(element.getAttribute("data-testid"));
        const selectorValue = buildSelector(element);
        const xpath = buildXPath(element);
        const contextRoot = element.closest("li, tr, article, section, [role=listitem], [role=row], .card, [class*=card], [class*=panel]") || element.parentElement;
        const contextText = clean(contextRoot?.innerText || "").slice(0, 320);
        const interactiveDescendant = element.querySelector("a[href], button, [role='button'], [role='tab']");

        if (!xpath || !selectorValue) {
          continue;
        }
        if (!text && !href && !ariaLabel && !title) {
          continue;
        }
        if (text.length > 240) {
          continue;
        }
        if ((tag === "div" || tag === "span" || tag === "p") && hasMeaningfulChild(element)) {
          continue;
        }
        if ((tag === "li" || role === "listitem") && interactiveDescendant && !href) {
          continue;
        }

        const dedupeKey = [xpath, text, href, ariaLabel, title].join("|");
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);

        entries.push({
          xpath,
          xpath_pattern: xpathPattern(xpath),
          selector: selectorValue,
          tag,
          role,
          text,
          href,
          aria_label: ariaLabel,
          title,
          data_view_name: dataViewName,
          data_test_id: dataTestId,
          context_text: contextText
        });
      }

      return entries.slice(0, 250);
    });
  }

  async function saveDomSnapshot(reason) {
    try {
      const pageUrl = page.url();
      if (!pageUrl || pageUrl === "about:blank") {
        return;
      }

      snapshotCounter += 1;
      const htmlName = `${String(snapshotCounter).padStart(3, "0")}_${sanitizeFileName(reason)}.html`;
      const metaName = `${String(snapshotCounter).padStart(3, "0")}_${sanitizeFileName(reason)}.json`;
      const htmlPath = path.join(domDir, htmlName);
      const metaPath = path.join(domDir, metaName);
      const clickCandidates = await listClickableCandidates();
      const domCatalog = await listDomCatalog();
      const [html, title, text] = await Promise.all([
        page.content(),
        page.title().catch(() => ""),
        page.locator("body").innerText().catch(() => "")
      ]);

      await fs.writeFile(htmlPath, html);
      await fs.writeFile(metaPath, JSON.stringify({
        reason,
        page_url: pageUrl,
        title,
        text_excerpt: text.slice(0, 4000),
        top_click_candidates: clickCandidates.slice(0, 15).map((candidate) => ({
          selector: candidate.selector,
          text: candidate.text,
          aria_label: candidate.ariaLabel,
          href: candidate.href,
          score: candidate.score,
          reasons: candidate.reasons
        })),
        dom_catalog: domCatalog
      }, null, 2));

      session.dom_snapshots.push({
        page_url: pageUrl,
        title,
        reason,
        html_file: path.relative(sessionDir, htmlPath),
        meta_file: path.relative(sessionDir, metaPath)
      });
    } catch (error) {
      console.error(`Failed to save DOM snapshot (${reason}): ${error.message}`);
    }
  }

  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) {
      return;
    }
    const currentUrl = frame.url();
    if (!seenPageUrls.has(currentUrl)) {
      seenPageUrls.add(currentUrl);
      session.page_urls.push(currentUrl);
    }
    console.log(`Visited: ${currentUrl}`);
    void page.waitForTimeout(1500).then(() => saveDomSnapshot("navigation")).catch(() => {});
  });

  page.on("response", async (response) => {
    try {
      const request = response.request();
      const resourceType = request.resourceType();
      const contentType = response.headers()["content-type"] || "";
      if (!(resourceType === "xhr" || resourceType === "fetch")) {
        return;
      }
      if (!contentType.includes("application/json")) {
        return;
      }

      const json = await response.json();
      responseCounter += 1;
      session.response_count = responseCounter;

      const entry = {
        captured_at: new Date().toISOString(),
        page_url: page.url(),
        active_interaction: activeInteraction,
        url: response.url(),
        method: request.method(),
        status: response.status(),
        operation_name: extractOperationName(response.url()),
        resource_type: resourceType,
        headers: response.headers(),
        json
      };

      const fileName = `${String(responseCounter).padStart(4, "0")}_${sanitizeFileName(entry.operation_name)}.json`;
      await fs.writeFile(path.join(responsesDir, fileName), JSON.stringify(entry, null, 2));
      responseEntries.push({
        file: fileName,
        url: entry.url,
        operation_name: entry.operation_name,
        active_interaction: activeInteraction
      });
      console.log(`Captured JSON response: ${entry.url}`);
    } catch (error) {
      console.error(`Failed to inspect ${response.url()}: ${error.message}`);
    }
  });

  function shouldSkipCandidate(candidate) {
    const fingerprint = normalizeText(`${candidate.text} ${candidate.ariaLabel} ${candidate.href} ${candidate.contextText}`);
    return DANGEROUS_TERMS.some((term) => fingerprint.includes(term));
  }

  async function exploreClicks() {
    const explored = new Set();
    let clickNumber = 0;

    while (clickNumber < maxClicks) {
      const candidates = await listClickableCandidates();
      const next = candidates.find((candidate) => {
        const key = [candidate.selector, candidate.text, candidate.ariaLabel, candidate.href, candidate.tag, candidate.role].join("|");
        if (explored.has(key) || shouldSkipCandidate(candidate)) {
          return false;
        }
        if (candidate.score < (targetProfile.tokens.length || targetProfile.phrases.length ? 10 : 1)) {
          return false;
        }
        return true;
      });

      if (!next) {
        break;
      }

      const key = [next.selector, next.text, next.ariaLabel, next.href, next.tag, next.role].join("|");
      explored.add(key);
      clickNumber += 1;

      const labelBase = next.text || next.ariaLabel || next.href || next.tag;
      const label = `click_${clickNumber}_${sanitizeFileName(labelBase)}`;
      const beforeUrl = page.url();
      const responsesBefore = responseCounter;
      activeInteraction = label;

      try {
        await page.locator(next.selector).first().click({ timeout: 5000 });
        await page.waitForTimeout(settleMs);
        await saveDomSnapshot(label);
      } catch (error) {
        session.interactions.push({
          label,
          selector: next.selector,
          text: next.text,
          aria_label: next.ariaLabel,
          href: next.href,
          candidate_score: next.score,
          candidate_reasons: next.reasons,
          before_url: beforeUrl,
          after_url: page.url(),
          new_responses: responseCounter - responsesBefore,
          status: "click_failed",
          error: error.message
        });
        activeInteraction = null;
        continue;
      }

      const afterUrl = page.url();
      const newResponses = responseEntries.slice(responsesBefore).map((entry) => ({
        file: entry.file,
        url: entry.url,
        operation_name: entry.operation_name
      }));
      session.interactions.push({
        label,
        selector: next.selector,
        text: next.text,
        aria_label: next.ariaLabel,
        href: next.href,
        candidate_score: next.score,
        candidate_reasons: next.reasons,
        before_url: beforeUrl,
        after_url: afterUrl,
        new_responses: responseCounter - responsesBefore,
        response_files: newResponses,
        status: "clicked"
      });

      if (isLikelyLoginUrl(afterUrl)) {
        console.log("Login page detected during auto-explore. Complete login manually; exploration will resume after login.");
        const resumed = await waitForLoginCompletion();
        session.interactions.push({
          label: `${label}_login_pause`,
          before_url: afterUrl,
          after_url: page.url(),
          new_responses: 0,
          status: resumed ? "login_resumed" : "login_wait_timed_out"
        });
        if (!resumed) {
          activeInteraction = null;
          return;
        }
      }

      if (afterUrl !== beforeUrl) {
        try {
          await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 });
          await page.waitForTimeout(settleMs);
        } catch {
          // Keep the current page when navigation history is not available.
        }
      }

      activeInteraction = null;
    }
  }

  async function waitForLoginCompletion() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < loginWaitMs) {
      if (contextClosed || page.isClosed()) {
        return false;
      }
      const currentUrl = page.url();
      if (!isLikelyLoginUrl(currentUrl)) {
        await page.waitForTimeout(settleMs);
        await saveDomSnapshot("post_login_resume");
        return true;
      }
      await page.waitForTimeout(1000);
    }

    console.log("Login wait timed out. Leave the browser open if you still need to finish login.");
    return false;
  }

  await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (autoExplore) {
    await page.waitForTimeout(settleMs);
    if (isLikelyLoginUrl(page.url())) {
      console.log("Login page detected. Complete login manually; auto-exploration is paused until login finishes.");
      const resumed = await waitForLoginCompletion();
      if (!resumed) {
        await new Promise((resolve) => {
          context.on("close", resolve);
          context.browser()?.on("disconnected", resolve);
        });
      }
    }
  }
  if (autoExplore && !contextClosed && !page.isClosed()) {
    await exploreClicks();
  }
  if (!contextClosed && !page.isClosed() && autoCloseMs) {
    await page.waitForTimeout(autoCloseMs);
    await context.close();
  } else if (!contextClosed && !page.isClosed() && autoExplore) {
    await context.close();
  } else if (!contextClosed && !page.isClosed()) {
    await new Promise((resolve) => {
      context.on("close", resolve);
      context.browser()?.on("disconnected", resolve);
    });
  }

  session.ended_at = new Date().toISOString();
  await fs.writeFile(path.join(sessionDir, "session.json"), JSON.stringify(session, null, 2));

  console.log("");
  console.log(`Capture complete. Session saved to ${sessionDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
