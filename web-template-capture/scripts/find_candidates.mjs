import fs from "node:fs/promises";
import path from "node:path";

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

  if (/(交易量|成交量|volume|turnover|\bvol\b)/.test(normalizedFieldName)) {
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

  if (/(30天|30日|30d|30day|30 day)/.test(normalizedFieldName)) {
    strictSemanticMatch = true;
    extras.push("30d", "30day", "30", "daily", "statistics");
  }

  if (/(创建时间|created_at|created at|creation time|signup)/.test(normalizedFieldName)) {
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
      candidate.dom_selector || "",
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

async function analyzeDom(sessionDir, options) {
  const domDir = path.join(sessionDir, "dom");
  let names = [];
  try {
    names = await fs.readdir(domDir);
  } catch {
    return [];
  }

  if (!options.hintValue) {
    return [];
  }

  const candidates = [];
  for (const name of names.filter((item) => item.endsWith(".html")).sort()) {
    const absolutePath = path.join(domDir, name);
    const html = await fs.readFile(absolutePath, "utf8");
    const index = html.toLowerCase().indexOf(String(options.hintValue).toLowerCase());
    if (index === -1) {
      continue;
    }

    candidates.push({
      source_type: "dom",
      score: 20,
      reasons: ["exact value found in DOM snapshot", "selector discovery still manual"],
      request_method: null,
      request_url: null,
      request_url_pattern: null,
      operation_name: null,
      json_path: null,
      dom_selector: null,
      sample_value: options.hintValue,
      page_url: null,
      file: path.relative(sessionDir, absolutePath)
    });
  }

  return candidates;
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

  const ownershipMode = args["ownership-mode"] || "page_subject";
  const hintValue = Object.prototype.hasOwnProperty.call(args, "hint-value") ? args["hint-value"] : null;
  const session = JSON.parse(await fs.readFile(path.join(sessionDir, "session.json"), "utf8"));

  const networkCandidates = await analyzeResponses(sessionDir, {
    fieldName,
    fieldType,
    hintValue,
    ownershipMode
  });
  const domCandidates = await analyzeDom(sessionDir, {
    hintValue
  });

  const candidates = dedupeCandidates([...networkCandidates, ...domCandidates])
    .sort((left, right) => right.score - left.score)
    .slice(0, 50);

  const report = {
    generated_at: new Date().toISOString(),
    session_dir: sessionDir,
    target: {
      field_name: fieldName,
      field_type: fieldType,
      hint_value: hintValue,
      ownership_mode: ownershipMode
    },
    site_url: session.site_url,
    top_candidates: candidates
  };

  const reportPath = path.join(sessionDir, "candidate-report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
