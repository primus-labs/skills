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

function buildResponseTemplateEntry(report, candidate) {
  const targetFieldName = report.target?.field_name || "";
  const fieldKey = inferFieldKey(candidate, targetFieldName);
  const expression = candidate.json_path || candidate.dom_xpath || candidate.dom_selector || null;
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

  const requestTemplate = {
    host: host || "",
    targetUrlExpression,
    targetUrlType: "REGX",
    ext: {},
    dynamicParamters: [],
    method: candidate.request_method || "GET"
  };

  const dataSourceTemplate = [
    {
      requestTemplate,
      responseTemplate: [buildResponseTemplateEntry(report, candidate)]
    }
  ];

  const defaultName = `${toSlug(dataSource) || "web"}-${toSlug(targetFieldName) || "value"}-mcp`;
  const defaultDescription = `Extracts ${normalizeWhitespace(targetFieldName)} from ${host || dataSource}.`;
  const templateDraft = {
    generated_at: new Date().toISOString(),
    selected_candidate_index: candidateIndex,
    websiteIcon: candidate.website_icon || report.website_icon || null,
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
      dom_selector: candidate.dom_selector || null,
      dom_xpath: candidate.dom_xpath || null,
      dom_item_xpath: candidate.dom_item_xpath || null,
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
      candidate.dom_xpath ? `Observed DOM XPath: ${candidate.dom_xpath}` : "No DOM XPath recorded for this candidate",
      candidate.value_attribute ? `Read extracted value from: ${candidate.value_attribute}` : "No explicit DOM value attribute recorded",
      sourceUrl ? `Observed while on page: ${sourceUrl}` : "No page URL recorded for this candidate",
      candidate.file ? `Evidence file: ${candidate.file}` : "No evidence file recorded"
    ]
  };

  const outputPath = path.join(path.dirname(reportPath), "template-draft.json");
  await fs.writeFile(outputPath, JSON.stringify(templateDraft, null, 2));
  console.log(JSON.stringify(templateDraft, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
