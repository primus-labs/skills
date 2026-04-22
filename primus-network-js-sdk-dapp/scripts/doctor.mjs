import fs from "node:fs";
import path from "node:path";

const skillDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const skillPath = path.join(skillDir, "SKILL.md");
const chainsPath = path.join(skillDir, "references", "chains.md");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkIncludes(content, snippet, message) {
  assert(content.includes(snippet), message);
}

function run() {
  const skill = read(skillPath);
  const chains = read(chainsPath);

  // ── Prerequisites ──
  checkIncludes(skill, "dev.primuslabs.xyz",
    "SKILL.md must link to the Primus Developer Hub for obtaining a Template ID.");

  checkIncludes(skill, "Template ID",
    "SKILL.md must mention Template ID as a prerequisite.");

  checkIncludes(skill, "Primus browser extension",
    "SKILL.md must mention the Primus browser extension as a prerequisite.");

  checkIncludes(skill, "Node.js 18",
    "SKILL.md must specify Node.js 18+ as a prerequisite.");

  checkIncludes(skill, "window.ethereum",
    "SKILL.md must reference window.ethereum, not hardcode a specific wallet.");

  checkIncludes(skill, "Base mainnet",
    "SKILL.md must mention Base mainnet as an option, not only testnet.");

  // ── Trigger prompt ──
  checkIncludes(skill, "Trigger Prompt",
    "SKILL.md must include a Trigger Prompt section for non-Claude IDEs.");

  // ── Output structure ──
  checkIncludes(skill, "vite.config.js",
    "SKILL.md must specify vite.config.js in the output structure.");

  checkIncludes(skill, "define: { global: 'globalThis' }",
    "SKILL.md must require the globalThis polyfill in vite.config.js.");

  // ── Working rules / pitfalls ──
  checkIncludes(skill, "await import()",
    "SKILL.md must warn against CDN dynamic import of the SDK.");

  checkIncludes(skill, "...submitTaskParams, ...submitTaskResult",
    "SKILL.md must document spreading both objects into attest().");

  checkIncludes(skill, "attestResult[0]",
    "SKILL.md must document that attestResult is an array accessed at [0].");

  checkIncludes(skill, "JSON.parse(att.data)",
    "SKILL.md must warn that att.data may be a JSON string and needs parsing.");

  checkIncludes(skill, "ensureCorrectChain",
    "SKILL.md must reference ensureCorrectChain() for chain switching.");

  checkIncludes(skill, "4902",
    "SKILL.md must handle wallet_addEthereumChain error code 4902.");

  checkIncludes(skill, "verifyAndPollTaskResult",
    "SKILL.md must mention verifyAndPollTaskResult (even if optional).");

  // ── main.js structure ──
  checkIncludes(skill, "DOM refs",
    "SKILL.md must document DOM refs ordering in main.js structure.");

  // ── chains.md ──
  const expectedChains = [
    ["84532",   "Base Sepolia chain ID"],
    ["8453",    "Base mainnet chain ID"],
    ["0x14a34", "Base Sepolia hex"],
    ["0x2105",  "Base mainnet hex"],
    ["https://sepolia.base.org",     "Base Sepolia RPC URL"],
    ["https://mainnet.base.org",     "Base mainnet RPC URL"],
    ["https://sepolia.basescan.org", "Base Sepolia explorer URL"],
  ];

  for (const [value, label] of expectedChains) {
    checkIncludes(chains, value,
      `chains.md is missing ${label} (${value}).`);
  }

  checkIncludes(chains, "wallet_addEthereumChain",
    "chains.md must include wallet_addEthereumChain config.");

  checkIncludes(chains, "ensureCorrectChain",
    "chains.md must contain the ensureCorrectChain() helper function.");

  checkIncludes(chains, "alchemy.com/faucets/base-sepolia",
    "chains.md must include a Base Sepolia faucet link.");

  // ── Output ──
  console.log("[ok] Developer Hub link (Template ID source) is present.");
  console.log("[ok] Template ID prerequisite is documented.");
  console.log("[ok] Primus browser extension prerequisite is documented.");
  console.log("[ok] Node.js 18+ prerequisite is documented.");
  console.log("[ok] window.ethereum wallet interface is documented.");
  console.log("[ok] Base mainnet is mentioned as an option.");
  console.log("[ok] Trigger Prompt section is present.");
  console.log("[ok] Vite output structure is documented.");
  console.log("[ok] globalThis polyfill requirement is present.");
  console.log("[ok] CDN dynamic import warning is present.");
  console.log("[ok] attest() spread pattern is documented.");
  console.log("[ok] attestResult array access (attestResult[0]) is documented.");
  console.log("[ok] att.data JSON parsing caveat is documented.");
  console.log("[ok] ensureCorrectChain is referenced.");
  console.log("[ok] Error code 4902 handling is documented.");
  console.log("[ok] verifyAndPollTaskResult is mentioned.");
  console.log("[ok] main.js DOM refs ordering is documented.");
  console.log(`[ok] Verified ${expectedChains.length} chain config entries in chains.md.`);
  console.log("[ok] wallet_addEthereumChain config is present in chains.md.");
  console.log("[ok] Faucet link is present in chains.md.");
}

try {
  run();
} catch (error) {
  console.error(`[error] ${error.message}`);
  process.exit(1);
}
