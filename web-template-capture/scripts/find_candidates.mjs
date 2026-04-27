import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalize(value).match(/[\p{L}\p{N}_]+/gu) || [];
}

function buildFieldProfile(fieldName) {
  const builtIns = {
    username: ["screen", "name", "screen_name", "handle", "username", "user_name", "login"],
    email: ["email", "mail", "email_address", "primary_email"],
    balance: ["balance", "amount", "total", "available", "funds"],
    volume: ["volume", "trading_volume", "trade_volume", "turnover", "amount"],
    trading: ["trade", "trading", "maker", "taker", "fee", "order"],
    connections: ["connections", "network", "contact", "contacts", "friend", "friends"],
    list: ["list", "items", "records", "entries"],
    tier: ["tier", "level", "membership", "plan", "rank"],
    status: ["status", "state", "stage"],
    id: ["id", "identifier", "account_id", "user_id", "member_id"],
    phone: ["phone", "mobile", "phone_number"],
    name: ["name", "full_name", "display_name"]
  };

  const normalizedFieldName = normalize(fieldName);
  const tokens = tokenize(fieldName);
  const extras = [];
  const negativeTokens = [];
  let strictSemanticMatch = false;

  for (const token of tokens) {
    if (builtIns[token]) {
      extras.push(...builtIns[token]);
    }
  }

  if (/(volume|turnover|\bvol\b)/.test(normalizedFieldName)) {
    strictSemanticMatch = true;
    extras.push(
      "volume",
      "vol",
      "turnover",
      "statistics",
      "trading",
      "trade",
      "spot30dvol",
      "futures30dvol",
      "tradingvolume",
      "trading_volume",
      "spottradingvolumestatistics",
      "futurestradingvolumestatistics"
    );
    negativeTokens.push("time", "timestamp", "level", "status", "commissionstatus", "date");
  }

  if (/(30d|30day|30 day|30-day|30 days)/.test(normalizedFieldName)) {
    strictSemanticMatch = true;
    extras.push("30d", "30day", "30", "daily", "statistics");
  }

  if (/(created_at|created at|creation time|signup)/.test(normalizedFieldName)) {
    strictSemanticMatch = true;
    extras.push("created", "created_at", "creation", "signup", "registered", "joined", "time", "date");
    negativeTokens.push("volume", "level", "status");
  }

  return {
    fieldTokens: new Set([...tokens, ...extras]),
    negativeTokens: new Set(negativeTokens),
    strictSemanticMatch
  };
}

function walkJson(value, visit, currentPath = "$", parentKey = "") {
  visit(currentPath, value, parentKey);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, visit, `${currentPath}[${index}]`, parentKey));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const nextPath = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
        ? `${currentPath}.${key}`
        : `${currentPath}["${key}"]`;
      walkJson(child, visit, nextPath, key);
    }
  }
}

function scoreLeaf({
  value,
  parentKey,
  jsonPath,
  url,
  activeInteraction,
  fieldProfile,
  hintValue,
  ownershipMode
}) {
  let score = 0;
  const reasons = [];
  const normalizedPath = normalize(jsonPath);
  const normalizedKey = normalize(parentKey);
  const normalizedUrl = normalize(url);
  const normalizedInteraction = normalize(activeInteraction || "");
  let semanticSignalCount = 0;

  if (hintValue !== null && normalize(value) === normalize(hintValue)) {
    score += 100;
    reasons.push("exact value match");
  }

  for (const token of fieldProfile.fieldTokens) {
    if (!token) {
      continue;
    }
    let matched = false;
    if (normalizedKey === token) {
      score += 28;
      reasons.push(`key matches ${token}`);
      matched = true;
    } else if (normalizedKey.includes(token)) {
      score += 14;
      reasons.push(`key contains ${token}`);
      matched = true;
    }

    if (normalizedPath.includes(token)) {
      score += 8;
      reasons.push(`path contains ${token}`);
      matched = true;
    }

    if (normalizedUrl.includes(token)) {
      score += 6;
      reasons.push(`url contains ${token}`);
      matched = true;
    }

    if (normalizedInteraction.includes(token)) {
      score += 10;
      reasons.push(`interaction contains ${token}`);
      matched = true;
    }

    if (matched) {
      semanticSignalCount += 1;
    }
  }

  for (const token of fieldProfile.negativeTokens) {
    if (!token) {
      continue;
    }

    if (normalizedKey === token || normalizedKey.includes(token)) {
      score -= 18;
      reasons.push(`key conflicts with ${token}`);
    }

    if (normalizedPath.includes(token)) {
      score -= 10;
      reasons.push(`path conflicts with ${token}`);
    }

    if (normalizedUrl.includes(token)) {
      score -= 8;
      reasons.push(`url conflicts with ${token}`);
    }
  }

  const depth = (jsonPath.match(/[.[\]]/g) || []).length;
  score -= Math.min(depth, 20);
  if (depth <= 4) {
    score += 12;
    reasons.push("shallow path");
  }

  if (ownershipMode === "current_user") {
    if (/(viewer|account|settings|me)\b/.test(normalizedUrl)) {
      score += 24;
      reasons.push("matches current-user endpoint");
    }
    if (/(timeline|recommend|search|explore|sidebar|promoted)/.test(normalizedUrl)) {
      score -= 18;
      reasons.push("noisy collection endpoint");
    }
  }

  if (/(profile|user|member|account)/.test(normalizedUrl)) {
    score += 8;
    reasons.push("entity-like endpoint");
  }

  if (/\[\d+\]/.test(jsonPath)) {
    score -= 6;
    reasons.push("path comes from collection entry");
  }

  if (fieldProfile.strictSemanticMatch && hintValue === null && semanticSignalCount === 0) {
    score -= 28;
    reasons.push("missing target-specific semantic match");
  }

  return { score, reasons };
}

function generalizeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.includes("graphql") && parts.length >= 2) {
      const opName = parts.at(-1);
      const prefix = parts.slice(0, -2).join("/");
      return {
        request_url_pattern: `${parsed.origin}/${prefix}/graphql/*/${opName}`,
        operation_name: opName
      };
    }
    return {
      request_url_pattern: `${parsed.origin}${parsed.pathname}`,
      operation_name: parts.at(-1) || null
    };
  } catch {
    return { request_url_pattern: rawUrl, operation_name: null };
  }
}

function dedupeReasons(reasons) {
  return [...new Set(reasons)];
}

function normalizeLookupUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(rawUrl || "");
  }
}

function urlContainsHintValue(rawUrl, hintValue) {
  if (hintValue === null || hintValue === undefined) {
    return false;
  }
  const normalizedHint = normalize(hintValue);
  if (!normalizedHint) {
    return false;
  }
  return normalize(rawUrl || "").includes(normalizedHint);
}

function buildWebsiteIconIndex(session) {
  const byPageUrl = new Map();
  const byOrigin = new Map();
  for (const entry of Array.isArray(session.website_icons) ? session.website_icons : []) {
    if (!entry?.website_icon) {
      continue;
    }
    const normalizedPageUrl = normalizeLookupUrl(entry.page_url);
    if (normalizedPageUrl && !byPageUrl.has(normalizedPageUrl)) {
      byPageUrl.set(normalizedPageUrl, entry.website_icon);
    }
    try {
      const origin = new URL(entry.page_url).origin;
      if (origin && !byOrigin.has(origin)) {
        byOrigin.set(origin, entry.website_icon);
      }
    } catch {
      // Ignore malformed page URLs in icon index.
    }
  }
  return { byPageUrl, byOrigin };
}

function lookupWebsiteIcon(iconIndex, ...urls) {
  for (const rawUrl of urls) {
    const normalized = normalizeLookupUrl(rawUrl);
    if (normalized && iconIndex.byPageUrl.has(normalized)) {
      return iconIndex.byPageUrl.get(normalized);
    }
  }
  for (const rawUrl of urls) {
    try {
      const origin = new URL(rawUrl).origin;
      if (origin && iconIndex.byOrigin.has(origin)) {
        return iconIndex.byOrigin.get(origin);
      }
    } catch {
      // Ignore malformed URLs when falling back to origin lookup.
    }
  }
  return null;
}

function isListLikeField(fieldName) {
  return /(list|connections|records|items|entries|followers|following|orders|transactions|contacts|friends)/i
    .test(String(fieldName || ""));
}

function splitXPath(xpath) {
  return String(xpath || "")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
}

function extractXPathTag(segment) {
  return String(segment || "").replace(/\[.*\]$/, "");
}

function buildCommonXPath(xpaths) {
  const partsList = xpaths.map(splitXPath).filter((parts) => parts.length > 0);
  if (partsList.length === 0) {
    return null;
  }

  const minLength = Math.min(...partsList.map((parts) => parts.length));
  const output = [];
  for (let index = 0; index < minLength; index += 1) {
    const segments = partsList.map((parts) => parts[index]);
    const first = segments[0];
    if (segments.every((segment) => segment === first)) {
      output.push(first);
      continue;
    }

    const firstTag = extractXPathTag(first);
    if (segments.every((segment) => extractXPathTag(segment) === firstTag)) {
      output.push(`${firstTag}[*]`);
      continue;
    }

    break;
  }

  return output.length > 0 ? `/${output.join("/")}` : null;
}

function chooseValueAttribute(nodes) {
  const hrefValues = [...new Set(nodes.map((node) => node.href).filter(Boolean))];
  const textValues = [...new Set(nodes.map((node) => node.text).filter(Boolean))];
  if (hrefValues.length >= 2) {
    return {
      valueAttribute: "href",
      values: hrefValues
    };
  }
  return {
    valueAttribute: "text",
    values: textValues
  };
}

function scoreDomListCandidate({
  nodes,
  listXPath,
  pageUrl,
  fieldProfile,
  fieldName,
  ownershipMode,
  valueAttribute
}) {
  let score = 40;
  const reasons = ["repeating DOM pattern", "list-like field with repeated nodes"];
  const normalizedPageUrl = normalize(pageUrl || "");
  const normalizedFieldName = normalize(fieldName || "");
  const normalizedListXPath = normalize(listXPath || "");
  const normalizedContexts = nodes.map((node) => normalize(node.context_text || "")).join(" ");
  const hrefValues = nodes.map((node) => normalize(node.href || "")).filter(Boolean);
  const distinctTextCount = new Set(nodes.map((node) => normalize(node.text || "")).filter(Boolean)).size;
  const distinctHrefCount = new Set(nodes.map((node) => normalize(node.href || "")).filter(Boolean)).size;
  const distinctValueCount = valueAttribute === "href" ? distinctHrefCount : distinctTextCount;
  const minRepeatedNodes = Math.min(nodes.length, 8);

  score += minRepeatedNodes * 8;
  reasons.push(`observed ${nodes.length} repeated nodes`);

  score += Math.min(distinctValueCount * 4, 24);
  reasons.push(`observed ${distinctValueCount} distinct values`);

  if (valueAttribute === "href") {
    score += 16;
    reasons.push("extracts from href attribute");
    if (distinctHrefCount >= 2) {
      score += 12;
      reasons.push("multiple distinct entity links");
    }
    if (hrefValues.every((href) => /\/in\//.test(href))) {
      score += 28;
      reasons.push("hrefs look like entity profile URLs");
    }
    if (hrefValues.some((href) => /\/help\/|about\.linkedin\.com|\/mobile\/|\/ad\/|\/messaging\//.test(href))) {
      score -= 34;
      reasons.push("hrefs look like generic footer/help/messaging links");
    }
  } else {
    score += 8;
    reasons.push("extracts from node text");
  }

  const averageDepth = nodes.reduce((sum, node) => sum + splitXPath(node.xpath).length, 0) / nodes.length;
  if (averageDepth <= 24) {
    score += 8;
    reasons.push("moderate xpath depth");
  } else {
    score -= 4;
    reasons.push("deep xpath");
  }

  for (const token of fieldProfile.fieldTokens) {
    if (!token) {
      continue;
    }
    if (normalizedPageUrl.includes(token)) {
      score += 8;
      reasons.push(`page url contains ${token}`);
    }
    if (normalizedFieldName.includes(token)) {
      score += 4;
      reasons.push(`field name contains ${token}`);
    }
    if (normalizedListXPath.includes(token)) {
      score += 4;
      reasons.push(`xpath contains ${token}`);
    }
    if (normalizedContexts.includes(token)) {
      score += 8;
      reasons.push(`context contains ${token}`);
    }
  }

  if (/footer/.test(normalizedListXPath)) {
    score -= 28;
    reasons.push("xpath is inside footer");
  }

  if (ownershipMode === "current_user" && /(me|account|profile|network|connections)/.test(normalizedPageUrl)) {
    score += 10;
    reasons.push("matches current-user list page");
  }

  return { score, reasons: dedupeReasons(reasons) };
}

function scoreDomCandidate({
  node,
  pageUrl,
  fieldProfile,
  fieldName,
  hintValue,
  ownershipMode
}) {
  let score = 0;
  const reasons = [];
  const normalizedText = normalize(node.text || "");
  const normalizedContext = normalize(node.context_text || "");
  const normalizedHref = normalize(node.href || "");
  const normalizedXPath = normalize(node.xpath || "");
  const normalizedPageUrl = normalize(pageUrl || "");
  const normalizedFieldName = normalize(fieldName || "");
  let semanticSignalCount = 0;

  if (hintValue !== null) {
    const normalizedHint = normalize(hintValue);
    if (normalizedText === normalizedHint || normalizedHref === normalizedHint) {
      score += 100;
      reasons.push("exact value match");
    } else if (normalizedText.includes(normalizedHint) || normalizedContext.includes(normalizedHint)) {
      score += 48;
      reasons.push("hint value found in DOM text");
    }
  }

  for (const token of fieldProfile.fieldTokens) {
    if (!token) {
      continue;
    }
    let matched = false;
    if (normalizedText === token) {
      score += 30;
      reasons.push(`text matches ${token}`);
      matched = true;
    } else if (normalizedText.includes(token)) {
      score += 14;
      reasons.push(`text contains ${token}`);
      matched = true;
    }

    if (normalizedContext.includes(token)) {
      score += 10;
      reasons.push(`context contains ${token}`);
      matched = true;
    }

    if (normalizedHref.includes(token)) {
      score += 8;
      reasons.push(`href contains ${token}`);
      matched = true;
    }

    if (normalizedXPath.includes(token)) {
      score += 6;
      reasons.push(`xpath contains ${token}`);
      matched = true;
    }

    if (normalizedPageUrl.includes(token)) {
      score += 6;
      reasons.push(`page url contains ${token}`);
      matched = true;
    }

    if (matched) {
      semanticSignalCount += 1;
    }
  }

  for (const token of fieldProfile.negativeTokens) {
    if (!token) {
      continue;
    }
    if (normalizedText.includes(token) || normalizedContext.includes(token)) {
      score -= 12;
      reasons.push(`dom text conflicts with ${token}`);
    }
    if (normalizedHref.includes(token) || normalizedPageUrl.includes(token)) {
      score -= 8;
      reasons.push(`dom url conflicts with ${token}`);
    }
  }

  if (node.xpath_pattern_count && node.xpath_pattern_count > 1) {
    score += Math.min(node.xpath_pattern_count * 4, 20);
    reasons.push("repeating DOM pattern");
  }

  if (node.tag === "a" && node.href) {
    score += 6;
    reasons.push("link-like record");
  }
  if (/^h[1-4]$/.test(node.tag)) {
    score += 6;
    reasons.push("heading-like field label");
  }
  if ((node.text || "").length > 120) {
    score -= 10;
    reasons.push("text too long");
  }

  if (ownershipMode === "current_user" && /(settings|account|me|profile|dashboard)/.test(normalizedPageUrl)) {
    score += 12;
    reasons.push("matches current-user page");
  }

  if (/\b(list|connections|records|items|friends)\b/.test(normalizedFieldName) && node.xpath_pattern_count > 1) {
    score += 14;
    reasons.push("list-like field with repeated nodes");
  }

  if (fieldProfile.strictSemanticMatch && hintValue === null && semanticSignalCount === 0) {
    score -= 24;
    reasons.push("missing target-specific semantic match");
  }

  return { score, reasons };
}

async function listJsonFiles(dirPath) {
  const names = await fs.readdir(dirPath);
  return names.filter((name) => name.endsWith(".json")).sort();
}

async function analyzeResponses(sessionDir, options) {
  const responsesDir = path.join(sessionDir, "responses");
  const responseFiles = await listJsonFiles(responsesDir);
  const fieldProfile = buildFieldProfile(options.fieldName);
  const candidates = [];

  for (const fileName of responseFiles) {
    const absolutePath = path.join(responsesDir, fileName);
    const raw = JSON.parse(await fs.readFile(absolutePath, "utf8"));
    walkJson(raw.json, (jsonPath, value, parentKey) => {
      const typeMatches =
        (options.fieldType === "string" && typeof value === "string") ||
        (options.fieldType === "number" && typeof value === "number") ||
        (options.fieldType === "boolean" && typeof value === "boolean") ||
        (options.fieldType === "date" && typeof value === "string");

      if (!typeMatches) {
        return;
      }

      if (urlContainsHintValue(raw.url, options.hintValue) || urlContainsHintValue(raw.page_url, options.hintValue)) {
        return;
      }

      const { score, reasons } = scoreLeaf({
        value,
        parentKey,
        jsonPath,
        url: raw.url,
        activeInteraction: raw.active_interaction,
        fieldProfile,
        hintValue: options.hintValue,
        ownershipMode: options.ownershipMode
      });

      if (score < 12) {
        return;
      }

      const generalized = generalizeUrl(raw.url);
      candidates.push({
        source_type: "network_json",
        score,
        reasons: dedupeReasons(reasons),
        request_method: raw.method,
        request_url: raw.url,
        request_url_pattern: generalized.request_url_pattern,
        operation_name: generalized.operation_name,
        json_path: jsonPath,
        sample_value: value,
        page_url: raw.page_url,
        website_icon: lookupWebsiteIcon(options.iconIndex, raw.page_url, options.siteUrl),
        active_interaction: raw.active_interaction,
        file: path.relative(sessionDir, absolutePath)
      });
    });
  }

  return candidates;
}

function dedupeCandidates(candidates) {
  const byKey = new Map();
  for (const candidate of candidates) {
    const identity = [
      candidate.source_type,
      candidate.request_url_pattern || "",
      candidate.json_path || "",
      candidate.html_selector || "",
      candidate.html_xpath || "",
      candidate.value_attribute || "",
      candidate.page_url || ""
    ].join("|");
    const existing = byKey.get(identity);
    if (!existing || candidate.score > existing.score) {
      byKey.set(identity, { ...candidate });
      continue;
    }

    existing.reasons = dedupeReasons([...existing.reasons, ...candidate.reasons]);
  }
  return [...byKey.values()];
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "));
}

function readAttribute(attributes, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\b${escaped}\\s*=\\s*"([^"]*)"`, "i"),
    new RegExp(`\\b${escaped}\\s*=\\s*'([^']*)'`, "i"),
    new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, "i")
  ];
  for (const pattern of patterns) {
    const match = attributes.match(pattern);
    if (match) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return "";
}

function escapeXPathLiteral(value) {
  const raw = String(value || "");
  if (!raw.includes("\"")) {
    return `"${raw}"`;
  }
  if (!raw.includes("'")) {
    return `'${raw}'`;
  }
  const parts = raw.split("\"");
  const quoted = [];
  for (let index = 0; index < parts.length; index += 1) {
    quoted.push(`"${parts[index]}"`);
    if (index < parts.length - 1) {
      quoted.push("'\"'");
    }
  }
  return `concat(${quoted.join(", ")})`;
}

function buildHtmlLocator(tag, attributes, text) {
  const id = readAttribute(attributes, "id");
  if (id) {
    return {
      xpath: `//*[@id=${escapeXPathLiteral(id)}]`,
      selector: `#${id}`
    };
  }

  for (const attributeName of ["data-testid", "data-test-id", "name", "aria-label", "title"]) {
    const attributeValue = readAttribute(attributes, attributeName);
    if (attributeValue) {
      return {
        xpath: `//${tag}[@${attributeName}=${escapeXPathLiteral(attributeValue)}]`,
        selector: `${tag}[${attributeName}="${attributeValue}"]`
      };
    }
  }

  const href = readAttribute(attributes, "href");
  if (href) {
    return {
      xpath: `//${tag}[@href=${escapeXPathLiteral(href)}]`,
      selector: `${tag}[href="${href}"]`
    };
  }

  const normalizedText = normalizeWhitespace(text);
  if (normalizedText) {
    return {
      xpath: `//${tag}[normalize-space()=${escapeXPathLiteral(normalizedText)}]`,
      selector: null
    };
  }

  return { xpath: null, selector: null };
}

function extractHtmlCatalog(html) {
  const entryPattern = /<([a-z][a-z0-9:-]*)([^>]*)>\s*([^<]{1,240}?)\s*<\/\1>/gi;
  const entries = [];
  const seen = new Set();
  let match;

  while ((match = entryPattern.exec(String(html || ""))) !== null) {
    const tag = match[1].toLowerCase();
    const attributes = match[2] || "";
    const text = normalizeWhitespace(decodeHtmlEntities(match[3] || ""));
    if (!text || text.length > 240) {
      continue;
    }

    const href = readAttribute(attributes, "href");
    const ariaLabel = readAttribute(attributes, "aria-label");
    const title = readAttribute(attributes, "title");
    const dataTestId = readAttribute(attributes, "data-testid") || readAttribute(attributes, "data-test-id");
    const { xpath, selector } = buildHtmlLocator(tag, attributes, text);
    if (!xpath) {
      continue;
    }

    const key = [tag, xpath, text, href, ariaLabel, title].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    entries.push({
      xpath,
      xpath_pattern: xpath,
      xpath_pattern_count: 1,
      selector,
      tag,
      role: readAttribute(attributes, "role"),
      text,
      href,
      aria_label: ariaLabel,
      title,
      data_test_id: dataTestId,
      context_text: text
    });
  }

  return entries;
}

async function analyzeHtmlResponses(sessionDir, options) {
  const responsesDir = path.join(sessionDir, "responses");
  const responseFiles = await listJsonFiles(responsesDir);
  const candidates = [];
  const fieldProfile = buildFieldProfile(options.fieldName);
  const listLikeField = isListLikeField(options.fieldName);
  for (const fileName of responseFiles) {
    const absolutePath = path.join(responsesDir, fileName);
    const raw = JSON.parse(await fs.readFile(absolutePath, "utf8"));
    const contentType = normalize(raw.content_type || "");
    if (!contentType.includes("text/html") || !raw.body_file) {
      continue;
    }

    const bodyPath = path.join(responsesDir, raw.body_file);
    const html = await fs.readFile(bodyPath, "utf8").catch(() => "");
    const htmlCatalog = extractHtmlCatalog(html);
    if (htmlCatalog.length === 0) {
      continue;
    }

    if (urlContainsHintValue(raw.url, options.hintValue) || urlContainsHintValue(raw.page_url, options.hintValue)) {
      continue;
    }

    const patternCounts = new Map();
    for (const node of htmlCatalog) {
      const key = node.xpath_pattern || node.xpath || "";
      if (!key) {
        continue;
      }
      patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
    }

    for (const node of htmlCatalog) {
      const enrichedNode = {
        ...node,
        xpath_pattern_count: patternCounts.get(node.xpath_pattern || node.xpath || "") || 1
      };
      const { score, reasons } = scoreDomCandidate({
        node: enrichedNode,
        pageUrl: raw.page_url,
        fieldProfile,
        fieldName: options.fieldName,
        hintValue: options.hintValue,
        ownershipMode: options.ownershipMode
      });

      if (score < 16) {
        continue;
      }

      const sampleValue = enrichedNode.text || enrichedNode.href || options.hintValue || null;
      candidates.push({
        source_type: "document_html",
        score,
        reasons: dedupeReasons([...reasons, "value observed in original HTML response"]),
        request_method: "GET",
        request_url: raw.url || null,
        request_url_pattern: raw.url || null,
        operation_name: null,
        json_path: null,
        html_selector: enrichedNode.selector || null,
        html_xpath: enrichedNode.xpath || null,
        html_xpath_pattern: enrichedNode.xpath_pattern || null,
        sample_value: sampleValue,
        page_url: raw.page_url || raw.url || null,
        website_icon: lookupWebsiteIcon(options.iconIndex, raw.page_url, raw.url, options.siteUrl),
        file: path.relative(sessionDir, bodyPath)
      });
    }

    if (listLikeField) {
      const groupedNodes = new Map();
      for (const node of htmlCatalog) {
        const key = [
          node.tag || "",
          node.xpath_pattern || "",
          node.data_test_id || "",
          node.href ? "href" : "text"
        ].join("|");
        if (!groupedNodes.has(key)) {
          groupedNodes.set(key, []);
        }
        groupedNodes.get(key).push(node);
      }

      for (const nodes of groupedNodes.values()) {
        if (nodes.length < 2) {
          continue;
        }

        const listXPath = buildCommonXPath(nodes.map((node) => node.xpath));
        if (!listXPath) {
          continue;
        }

        const { valueAttribute, values } = chooseValueAttribute(nodes);
        if (values.length < 2) {
          continue;
        }

        const { score, reasons } = scoreDomListCandidate({
          nodes,
          listXPath,
          pageUrl: raw.page_url || raw.url,
          fieldProfile,
          fieldName: options.fieldName,
          ownershipMode: options.ownershipMode,
          valueAttribute
        });

        if (score < 24) {
          continue;
        }

        candidates.push({
          source_type: "document_html",
          score,
          reasons: dedupeReasons([...reasons, "grouped as a full HTML response extraction"]),
          request_method: "GET",
          request_url: raw.url || null,
          request_url_pattern: raw.url || null,
          operation_name: null,
          json_path: null,
          html_selector: null,
          html_xpath: listXPath,
          html_xpath_pattern: nodes[0].xpath_pattern || null,
          html_item_xpath: nodes[0].xpath_pattern || null,
          value_attribute: valueAttribute,
          sample_value: values.slice(0, 10),
          page_url: raw.page_url || raw.url || null,
          website_icon: lookupWebsiteIcon(options.iconIndex, raw.page_url, raw.url, options.siteUrl),
          file: path.relative(sessionDir, bodyPath)
        });
      }
    }
  }
  return candidates;
}

export async function collectCandidatesForSession({
  sessionDir,
  fieldName,
  fieldType,
  hintValue = null,
  ownershipMode = "page_subject"
}) {
  const session = JSON.parse(await fs.readFile(path.join(sessionDir, "session.json"), "utf8"));
  const iconIndex = buildWebsiteIconIndex(session);

  const networkCandidates = await analyzeResponses(sessionDir, {
    fieldName,
    fieldType,
    hintValue,
    ownershipMode,
    iconIndex,
    siteUrl: session.site_url
  });
  const htmlCandidates = await analyzeHtmlResponses(sessionDir, {
    fieldName,
    hintValue,
    ownershipMode,
    iconIndex,
    siteUrl: session.site_url
  });

  const candidates = dedupeCandidates([...networkCandidates, ...htmlCandidates])
    .sort((left, right) => right.score - left.score)
    .slice(0, 50);

  return {
    generated_at: new Date().toISOString(),
    session_dir: sessionDir,
    target: {
      field_name: fieldName,
      field_type: fieldType,
      hint_value: hintValue,
      ownership_mode: ownershipMode
    },
    site_url: session.site_url,
    website_icon: lookupWebsiteIcon(iconIndex, session.site_url),
    top_candidates: candidates
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sessionDir = args.session;
  if (!sessionDir) {
    throw new Error("Missing required --session");
  }

  const fieldName = args["field-name"];
  const fieldType = args["field-type"];
  if (!fieldName || !fieldType) {
    throw new Error("Missing required --field-name or --field-type");
  }

  const report = await collectCandidatesForSession({
    sessionDir,
    fieldName,
    fieldType,
    hintValue: Object.prototype.hasOwnProperty.call(args, "hint-value") ? args["hint-value"] : null,
    ownershipMode: args["ownership-mode"] || "page_subject"
  });
  const reportPath = path.join(sessionDir, "candidate-report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
