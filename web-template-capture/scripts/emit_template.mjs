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

function buildCandidateSummary(candidate, index, topCandidate) {
  const whyNotTop = [];
  if (candidate.score < topCandidate.score) {
    whyNotTop.push(`lower score than top candidate (${candidate.score} < ${topCandidate.score})`);
  }
  if ((candidate.page_url || null) !== (topCandidate.page_url || null)) {
    whyNotTop.push("observed on a different source page");
  }
  if ((candidate.request_url_pattern || null) !== (topCandidate.request_url_pattern || null)) {
    whyNotTop.push("uses a different request pattern");
  }

  return {
    index,
    source_url: candidate.page_url || null,
    request_method: candidate.request_method,
    request_url_pattern: candidate.request_url_pattern,
    operation_name: candidate.operation_name || null,
    json_path: candidate.json_path || null,
    dom_selector: candidate.dom_selector || null,
    sample_value: candidate.sample_value,
    score: candidate.score,
    why_not_top: whyNotTop
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
  const alternativeCount = Number(args.alternatives || 3);
  const candidate = report.top_candidates[candidateIndex];
  if (!candidate) {
    throw new Error(`No candidate found at index ${candidateIndex}`);
  }

  const sourceUrl = candidate.page_url || report.site_url || null;
  const alternatives = report.top_candidates
    .map((entry, index) => ({ entry, index }))
    .filter(({ index }) => index !== candidateIndex)
    .slice(0, alternativeCount)
    .map(({ entry, index }) => buildCandidateSummary(entry, index, report.top_candidates[0]));
  const templateDraft = {
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
      dom_selector: candidate.dom_selector || null,
      sample_value: candidate.sample_value
    },
    stability: {
      score: candidate.score,
      reasons: candidate.reasons
    },
    alternatives,
    notes: [
      candidate.request_url ? `Observed request: ${candidate.request_url}` : "Observed in DOM snapshot only",
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
