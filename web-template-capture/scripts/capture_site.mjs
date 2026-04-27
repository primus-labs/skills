import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
  /\/sign-in\b/i,
  /\/sessions\/two-factor(?:\/|$)/i,
  /\/two-factor(?:\/|$)/i,
  /\/2fa(?:\/|$)/i,
  /\/otp(?:\/|$)/i,
  /\/session\b/i,
  /\/verify\b/i,
  /\/verification\b/i,
  /\/challenge\b/i,
  /\/checkpoint\b/i,
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

function extractLinkAttr(attributesChunk, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = attributesChunk.match(new RegExp(`\\b${esc}\\s*=\\s*"([^"]*)"`, "i"));
  if (m) return m[1].trim();
  m = attributesChunk.match(new RegExp(`\\b${esc}\\s*=\\s*'([^']*)'`, "i"));
  if (m) return m[1].trim();
  // unquoted value: any non-whitespace, non->, non-quote characters (allows leading / for paths)
  m = attributesChunk.match(new RegExp(`\\b${esc}\\s*=\\s*([^\\s>"'][^\\s>]*)`, "i"));
  return m ? m[1].trim() : null;
}

/**
 * Fallback when page.evaluate misses icon-like logo assets: parse the same HTML string we persist to disk.
 * Handles attribute order (href before rel or vice versa) and matches saved snapshot 1:1.
 */
function extractWebsiteIconFromHtml(html, baseHref) {
  if (!html || typeof html !== "string") {
    return null;
  }
  let base;
  try {
    base = new URL(baseHref).href;
  } catch {
    return null;
  }
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const scope = headMatch ? headMatch[1] : html.slice(0, 400_000);
  const linkRe = /<link\s([^>]+)>/gi;
  const candidates = [];
  const seen = new Set();
  let m;
  const parseSizesScore = (sizesRaw) => {
    const normalized = String(sizesRaw || "").trim().toLowerCase();
    if (!normalized) {
      return 0;
    }
    if (normalized.includes("any")) {
      return 120;
    }
    let best = 0;
    for (const entry of normalized.split(/\s+/)) {
      const pair = entry.match(/^(\d+)x(\d+)$/);
      if (pair) {
        const w = Number(pair[1]);
        const h = Number(pair[2]);
        best = Math.max(best, Math.min(w * h, 512 * 512));
      } else {
        const one = entry.match(/^(\d+)$/);
        if (one) {
          const n = Number(one[1]);
          best = Math.max(best, Math.min(n * n, 512 * 512));
        }
      }
    }
    return best;
  };
  while ((m = linkRe.exec(scope)) !== null) {
    const attrs = m[1];
    const rel = extractLinkAttr(attrs, "rel");
    const href = extractLinkAttr(attrs, "href");
    if (!rel || !href || !/icon/i.test(rel)) {
      continue;
    }
    let resolved;
    try {
      resolved = new URL(href, base).href;
    } catch {
      continue;
    }
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    const normalizedRel = rel.toLowerCase();
    const type = extractLinkAttr(attrs, "type") || "";
    const sizes = extractLinkAttr(attrs, "sizes") || "";
    const fetchPriority = extractLinkAttr(attrs, "fetchpriority") || "";
    let score = 0;
    if (normalizedRel.includes("icon") && !normalizedRel.includes("apple-touch") && !normalizedRel.includes("mask") && !normalizedRel.includes("alternate") && !normalizedRel.includes("fluid")) {
      score += normalizedRel.includes("shortcut icon") ? 95 : 110;
    } else if (normalizedRel.includes("icon") && normalizedRel.includes("apple-touch")) {
      score += 85;
    } else if (normalizedRel.includes("fluid-icon")) {
      score += 90;
    } else if (normalizedRel.includes("alternate") && normalizedRel.includes("icon")) {
      score += 80;
    } else if (normalizedRel.includes("mask-icon")) {
      score += 70;
    }
    const normalizedType = type.toLowerCase();
    const rlow = resolved.toLowerCase();
    if (normalizedType.includes("svg") || rlow.includes(".svg")) {
      score += 8;
    } else if (normalizedType.includes("png") || rlow.includes(".png")) {
      score += 6;
    } else if (rlow.endsWith(".ico") || rlow.includes(".ico?")) {
      score += 5;
    }
    const sizeScore = parseSizesScore(sizes);
    score += Math.min(sizeScore / 256, 24);
    if (sizeScore > 0 && sizeScore <= 32 * 32) {
      score += 4;
    }
    if (fetchPriority.toLowerCase() === "high") {
      score += 3;
    }
    candidates.push({
      url: resolved,
      score,
      rel: normalizedRel,
      type: type || null,
      sizes: sizes || null
    });
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.url.length || 0) - (b.url.length || 0);
  });
  const best = candidates[0];
  return {
    website_icon: best.url,
    website_icon_meta: {
      source: "html_parse",
      rel: best.rel,
      type: best.type,
      sizes: best.sizes
    }
  };
}

async function getWebsiteIcon(page) {
  return page.evaluate(async () => {
    const resolveUrl = (value) => {
      if (!value) {
        return null;
      }
      try {
        return new URL(value, document.baseURI).href;
      } catch {
        return null;
      }
    };
    const clean = (value) => String(value || "").trim();
    const isValidOrigin = (url) => {
      try {
        const u = new URL(url);
        return u.origin && u.origin !== "null" && !u.origin.startsWith("about:");
      } catch {
        return false;
      }
    };
    const parseSizesScore = (sizes) => {
      const normalized = clean(sizes).toLowerCase();
      if (!normalized) {
        return 0;
      }
      if (normalized.includes("any")) {
        return 120;
      }
      let best = 0;
      for (const entry of normalized.split(/\s+/)) {
        const match = entry.match(/^(\d+)x(\d+)$/i);
        if (match) {
          const w = Number(match[1]);
          const h = Number(match[2]);
          best = Math.max(best, Math.min(w * h, 512 * 512));
        } else {
          const single = entry.match(/^(\d+)$/);
          if (single) {
            const n = Number(single[1]);
            best = Math.max(best, Math.min(n * n, 512 * 512));
          }
        }
      }
      return best;
    };
    const scoreCandidate = (normalizedRel, source, resolvedUrl, normalizedType, sizes, fetchPriority) => {
      let score = 0;
      if (source === "manifest") {
        score += 100;
      } else if (normalizedRel.includes("icon") && !normalizedRel.includes("apple-touch") && !normalizedRel.includes("mask") && !normalizedRel.includes("alternate") && !normalizedRel.includes("fluid")) {
        score += normalizedRel.includes("shortcut icon") ? 95 : 110;
      } else if (normalizedRel.includes("icon") && normalizedRel.includes("apple-touch")) {
        score += 85;
      } else if (normalizedRel.includes("fluid-icon")) {
        score += 90;
      } else if (normalizedRel.includes("alternate") && normalizedRel.includes("icon")) {
        score += 80;
      } else if (normalizedRel.includes("mask-icon")) {
        score += 70;
      } else if (source === "msapplication-TileImage") {
        score += 55;
      } else if (source === "og:image") {
        score += 25;
      }
      const rlow = resolvedUrl.toLowerCase();
      if (normalizedType.includes("svg") || rlow.includes(".svg")) {
        score += 8;
      } else if (normalizedType.includes("png") || rlow.includes(".png")) {
        score += 6;
      } else if (rlow.endsWith(".ico") || rlow.includes(".ico?")) {
        score += 5;
      }
      const sizeScore = parseSizesScore(sizes);
      score += Math.min(sizeScore / 256, 24);
      if (sizeScore > 0 && sizeScore <= 32 * 32) {
        score += 4;
      }
      if (clean(fetchPriority).toLowerCase() === "high") {
        score += 3;
      }
      return score;
    };
    const candidates = [];
    const seen = new Set();

    const pushCandidate = ({ href, source, rel = "", type = "", sizes = "", fetchPriority = "" }) => {
      const resolved = resolveUrl(href);
      if (!resolved || seen.has(resolved)) {
        return;
      }
      seen.add(resolved);
      const normalizedRel = clean(rel).toLowerCase();
      const normalizedType = clean(type).toLowerCase();
      const score = scoreCandidate(normalizedRel, source, resolved, normalizedType, sizes, fetchPriority);
      candidates.push({
        url: resolved,
        source,
        rel: normalizedRel || null,
        type: normalizedType || null,
        sizes: clean(sizes) || null,
        score
      });
    };

    // --- Standard <link rel="*icon*"> tags ---
    document.querySelectorAll("link[rel]").forEach((element) => {
      const rel = clean(element.getAttribute("rel"));
      if (!/icon/i.test(rel)) {
        return;
      }
      pushCandidate({
        href: element.getAttribute("href"),
        source: "link",
        rel,
        type: element.getAttribute("type"),
        sizes: element.getAttribute("sizes"),
        fetchPriority: element.getAttribute("fetchpriority") || ""
      });
    });

    // --- Meta tag sources ---
    const tileImage = document.querySelector('meta[name="msapplication-TileImage"]');
    if (tileImage) {
      pushCandidate({
        href: tileImage.getAttribute("content"),
        source: "msapplication-TileImage"
      });
    }

    // --- Web App Manifest icons ---
    const manifestEl = document.querySelector('link[rel~="manifest"]');
    if (manifestEl?.href) {
      try {
        const manifestBase = new URL(manifestEl.href, document.baseURI).href;
        const resp = await fetch(manifestBase, { credentials: "same-origin" });
        if (resp.ok) {
          const manifest = await resp.json();
          for (const icon of Array.isArray(manifest.icons) ? manifest.icons : []) {
            if (!icon?.src) {
              continue;
            }
            const purpose = String(icon.purpose || "any").toLowerCase().trim();
            if (purpose === "maskable") {
              continue;
            }
            try {
              const iconHref = new URL(icon.src, manifestBase).href;
              pushCandidate({
                href: iconHref,
                source: "manifest",
                rel: "manifest-icon",
                type: icon.type || "",
                sizes: icon.sizes || ""
              });
            } catch {
              // ignore unresolvable manifest icon src
            }
          }
        }
      } catch {
        // manifest fetch failure is non-fatal
      }
    }

    // --- Social card image fallback ---
    // Only consider og:image when no dedicated site icon/logo asset was found.
    if (candidates.length === 0) {
      const ogImage = document.querySelector('meta[property="og:image"], meta[name="og:image"]');
      if (ogImage) {
        pushCandidate({
          href: ogImage.getAttribute("content"),
          source: "og:image"
        });
      }
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.url.length || 0) - (b.url.length || 0);
    });
    let best;
    if (candidates.length > 0) {
      best = candidates[0];
    } else {
      try {
        const origin = window.location.origin;
        if (origin && isValidOrigin(window.location.href)) {
          best = {
            url: new URL("/favicon.ico", origin).href,
            source: "fallback",
            rel: null,
            type: null,
            sizes: null,
            score: 1
          };
        } else {
          best = null;
        }
      } catch {
        best = null;
      }
    }
    if (!best) {
      return {
        website_icon: null,
        website_icon_meta: null
      };
    }
    return {
      website_icon: best.url,
      website_icon_meta: {
        source: best.source,
        rel: best.rel,
        type: best.type,
        sizes: best.sizes
      }
    };
  }).catch(() => ({
    website_icon: null,
    website_icon_meta: null
  }));
}

export function isAuthenticationInProgressUrl(value) {
  const url = String(value || "");
  return LOGIN_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function isReadyToResumeAfterAuthentication({ currentUrl, entryUrl, authSignalsPresent = false }) {
  const rawUrl = String(currentUrl || "");
  if (!rawUrl || authSignalsPresent || isAuthenticationInProgressUrl(rawUrl)) {
    return false;
  }

  try {
    const current = new URL(rawUrl);
    const entry = entryUrl ? new URL(entryUrl) : null;
    if (!entry) {
      return true;
    }

    if (current.origin !== entry.origin) {
      return false;
    }

    const currentRoute = `${current.pathname}${current.search}${current.hash}`;
    const entryRoute = `${entry.pathname}${entry.search}${entry.hash}`;

    if (currentRoute !== entryRoute) {
      return true;
    }

    return current.pathname === "/" || current.pathname === "";
  } catch {
    return false;
  }
}

async function detectAuthenticationSignals(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const passwordField = document.querySelector('input[type="password"]');
    if (passwordField && isVisible(passwordField)) {
      return true;
    }

    const otpSelector = [
      'input[autocomplete="one-time-code"]',
      'input[name*="otp" i]',
      'input[id*="otp" i]',
      'input[name*="two_factor" i]',
      'input[id*="two_factor" i]',
      'input[name*="verification" i]',
      'input[id*="verification" i]',
      'input[name*="authenticator" i]',
      'input[id*="authenticator" i]',
      'input[name*="security_code" i]',
      'input[id*="security_code" i]'
    ].join(", ");
    const otpField = document.querySelector(otpSelector);
    if (otpField && isVisible(otpField)) {
      return true;
    }

    const authText = (document.body?.innerText || "").toLowerCase();
    return /(two-factor|two factor|verification code|security code|one-time code|authenticator app|enter the code)/i.test(authText);
  }).catch(() => false);
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

  const session = {
    site_url: siteUrl,
    site_slug: siteSlug,
    session_id: sessionId,
    navigation_hint: navigationHint,
    started_at: new Date().toISOString(),
    target: targetProfile,
    page_urls: [],
    website_icons: [],
    response_count: 0,
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
    void getWebsiteIcon(page).then((iconInfo) => {
      if (!iconInfo?.website_icon) {
        return;
      }
      const existing = session.website_icons.find((entry) => entry.page_url === currentUrl);
      if (existing) {
        existing.website_icon = iconInfo.website_icon;
        existing.website_icon_meta = iconInfo.website_icon_meta;
        return;
      }
      session.website_icons.push({
        page_url: currentUrl,
        website_icon: iconInfo.website_icon,
        website_icon_meta: iconInfo.website_icon_meta
      });
    }).catch(() => {});
  });

  page.on("response", async (response) => {
    try {
      const request = response.request();
      const resourceType = request.resourceType();
      const contentType = response.headers()["content-type"] || "";
      if (resourceType === "document" && contentType.includes("text/html")) {
        const html = await response.text();
        responseCounter += 1;
        session.response_count = responseCounter;
        const operationName = extractOperationName(response.url());
        const bodyFile = `${String(responseCounter).padStart(4, "0")}_${sanitizeFileName(operationName)}.html`;
        const metaFile = `${String(responseCounter).padStart(4, "0")}_${sanitizeFileName(operationName)}.json`;
        await fs.writeFile(path.join(responsesDir, bodyFile), html);
        await fs.writeFile(path.join(responsesDir, metaFile), JSON.stringify({
          captured_at: new Date().toISOString(),
          page_url: page.url(),
          active_interaction: activeInteraction,
          url: response.url(),
          method: request.method(),
          status: response.status(),
          operation_name: operationName,
          resource_type: resourceType,
          content_type: contentType,
          headers: response.headers(),
          body_file: bodyFile
        }, null, 2));
        responseEntries.push({
          file: metaFile,
          url: response.url(),
          operation_name: operationName,
          active_interaction: activeInteraction
        });
        console.log(`Captured HTML document: ${response.url()}`);
        return;
      }

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

      let afterUrl = page.url();
      let resumedFromAuthentication = false;

      if (isAuthenticationInProgressUrl(afterUrl)) {
        console.log("Login page detected during auto-explore. Complete login manually; exploration will resume after login.");
        const resumed = await waitForLoginCompletion();
        resumedFromAuthentication = resumed;
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
        afterUrl = page.url();
      }

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
        status: resumedFromAuthentication ? "clicked_after_login_resume" : "clicked"
      });

      if (!resumedFromAuthentication && afterUrl !== beforeUrl) {
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
      const authSignalsPresent = await detectAuthenticationSignals(page);
      if (isReadyToResumeAfterAuthentication({
        currentUrl,
        entryUrl: siteUrl,
        authSignalsPresent
      })) {
        await page.waitForTimeout(settleMs);
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
    if (isAuthenticationInProgressUrl(page.url())) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
