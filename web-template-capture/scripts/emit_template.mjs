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

function normalizeWhitespace(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function toSnakeCase(value) {
  return normalizeWhitespace(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function toSlug(value) {
  return normalizeWhitespace(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function titleCase(value) {
  return normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferHost(...values) {
  for (const value of values) {
    if (!value) {
      continue;
    }
    try {
      return new URL(value).host;
    } catch {
      continue;
    }
  }
  return null;
}

function inferDataSource(host, fallbackUrl) {
  if (host) {
    const segments = host.split(".").filter(Boolean);
    if (segments.length >= 2) {
      return segments.at(-2);
    }
    return host;
  }

  if (fallbackUrl) {
    try {
      return new URL(fallbackUrl).hostname.split(".").filter(Boolean).at(-2) || "web";
    } catch {
      return "web";
    }
  }

  return "web";
}

function escapeRegexLiteral(value) {
  return String(value).replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function buildTargetUrlExpression(candidate) {
  const rawUrl = candidate.request_url_pattern || candidate.request_url || candidate.page_url || "";
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const pathWithWildcards = `${parsed.origin}${parsed.pathname}`;
    const wildcardParts = pathWithWildcards.split("*");
    const escapedPath = wildcardParts.map(escapeRegexLiteral).join(".*");
    return parsed.search ? `${escapedPath}\\?.*` : `${escapedPath}(?:\\?.*)?`;
  } catch {
    const wildcardParts = String(rawUrl).split("*");
    return wildcardParts.map(escapeRegexLiteral).join(".*");
  }
}

function extractJsonLeafKey(jsonPath) {
  if (!jsonPath) {
    return null;
  }

  const bracketMatch = jsonPath.match(/\["([^"]+)"\]$/);
  if (bracketMatch) {
    return bracketMatch[1];
  }

  const dotMatch = jsonPath.match(/\.([A-Za-z0-9_:-]+)$/);
  if (dotMatch) {
    return dotMatch[1];
  }

  return null;
}

function inferFieldKey(candidate, targetFieldName) {
  return (
    extractJsonLeafKey(candidate.json_path) ||
    toSnakeCase(targetFieldName) ||
    "value"
  );
}

function inferFieldDataType(report, candidate) {
  const explicitType = report.target?.field_type;
  if (explicitType) {
    return explicitType;
  }

  if (Array.isArray(candidate.sample_value)) {
    return "array";
  }

  switch (typeof candidate.sample_value) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
    default:
      return "string";
  }
}

export function normalizeHtmlResolverExpression(expression) {
  const raw = String(expression || "").trim();
  if (!raw) {
    return raw;
  }

  return raw.endsWith("?") ? raw : `${raw}?`;
}

export function buildResponseTemplateEntry(report, candidate) {
  const targetFieldName = report.target?.field_name || "";
  const fieldKey = inferFieldKey(candidate, targetFieldName);
  const htmlExpression = candidate.html_xpath || candidate.html_selector || null;
  const expression = candidate.json_path || (htmlExpression ? normalizeHtmlResolverExpression(htmlExpression) : null);
  if (!expression) {
    throw new Error("Selected candidate does not include a JSONPath or XPath expression");
  }

  return {
    resolver: {
      type: "JSON_PATH",
      expression
    },
    valueType: "FIXED_VALUE",
    fieldType: "FIELD_REVEAL",
    feilds: [
      {
        fieldName: targetFieldName,
        showName: titleCase(targetFieldName),
        key: fieldKey,
        DataType: inferFieldDataType(report, candidate)
      }
    ]
  };
}

function isHtmlOnlyCandidate(candidate) {
  return candidate?.source_type === "document_html" || (!candidate?.json_path && Boolean(candidate?.html_xpath || candidate?.html_selector));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = args.report;
  if (!reportPath) {
    throw new Error("Missing required --report");
  }

  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const candidateIndex = Number(args.index || 0);
  const candidate = report.top_candidates[candidateIndex];
  if (!candidate) {
    throw new Error(`No candidate found at index ${candidateIndex}`);
  }

  const sourceUrl = candidate.page_url || report.site_url || null;
  const host = inferHost(candidate.request_url, candidate.request_url_pattern, sourceUrl);
  const dataSource = args["data-source"] || inferDataSource(host, sourceUrl || report.site_url || null);
  const targetFieldName = report.target?.field_name || "value";
  const targetUrlExpression = buildTargetUrlExpression(candidate);
  if (!targetUrlExpression) {
    throw new Error("Unable to derive requestTemplate.targetUrlExpression from selected candidate");
  }
  const htmlOnly = isHtmlOnlyCandidate(candidate);

  const requestTemplate = {
    host: host || "",
    targetUrlExpression,
    targetUrlType: "REGX",
    ext: {},
    dynamicParamters: [],
    method: candidate.request_method || "GET"
  };
  if (htmlOnly) {
    requestTemplate.ignoreResponse = true;
  }

  const dataSourceTemplate = [
    {
      requestTemplate,
      responseTemplate: [buildResponseTemplateEntry(report, candidate)]
    }
  ];

  const alternatives = report.top_candidates
    .slice(0, Math.max(1, Number(args.alternatives || 3)))
    .map((item, index) => ({
      index,
      source_type: item.source_type,
      request_url_pattern: item.request_url_pattern || item.request_url || item.page_url || null,
      json_path: item.json_path || null,
      html_xpath: item.html_xpath || item.html_selector || null,
      score: item.score,
      reasons: item.reasons
    }));

  const defaultName = `${toSlug(dataSource) || "web"}-${toSlug(targetFieldName) || "value"}-mcp`;
  const defaultDescription = `Extracts ${normalizeWhitespace(targetFieldName)} from ${host || dataSource}.`;
  const templateDraft = {
    name: args.name || defaultName,
    description: args.description || defaultDescription,
    websiteIcon: candidate.website_icon || report.website_icon || null,
    category: args.category || "OTHER",
    status: "AVAILABLE",
    dataSource,
    testResult: "SUCCESS",
    templatePrivate: true,
    dataPageTemplate: JSON.stringify({
      baseUrl: sourceUrl || report.site_url || ""
    }),
    dataSourceTemplate: JSON.stringify(dataSourceTemplate),
    generated_at: new Date().toISOString(),
    selected_candidate_index: candidateIndex,
    target: report.target,
    source: {
      source_type: candidate.source_type,
      source_url: sourceUrl,
      entry_url: report.site_url || null,
      request_method: candidate.request_method,
      request_url_pattern: candidate.request_url_pattern,
      operation_name: candidate.operation_name || null
    },
    field: {
      json_path: candidate.json_path || null,
      html_selector: candidate.html_selector || null,
      html_xpath: candidate.html_xpath || null,
      html_item_xpath: candidate.html_item_xpath || null,
      value_attribute: candidate.value_attribute || null,
      sample_value: candidate.sample_value
    },
    stability: {
      score: candidate.score,
      reasons: candidate.reasons
    },
    alternatives,
    notes: [
      candidate.request_url ? `Observed request: ${candidate.request_url}` : "Observed in DOM snapshot only",
      candidate.html_xpath ? `Observed HTML XPath: ${candidate.html_xpath}` : "No HTML XPath recorded for this candidate",
      candidate.value_attribute ? `Read extracted value from: ${candidate.value_attribute}` : "No explicit HTML value attribute recorded",
      sourceUrl ? `Observed while on page: ${sourceUrl}` : "No page URL recorded for this candidate",
      candidate.file ? `Evidence file: ${candidate.file}` : "No evidence file recorded"
    ]
  };

  const outputPath = path.join(path.dirname(reportPath), "template-draft.json");
  await fs.writeFile(outputPath, JSON.stringify(templateDraft, null, 2));
  console.log(JSON.stringify(templateDraft, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
