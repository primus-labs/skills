import fs from "node:fs";
import path from "node:path";

const skillDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const skillPath = path.join(skillDir, "SKILL.md");
const usagePath = path.join(skillDir, "references", "usage-guide.md");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkIncludes(content, snippet, message) {
  assert(content.includes(snippet), message);
}

function run() {
  const skill = read(skillPath);
  const usage = read(usagePath);

  const expectedNetworks = [
    ["Linea", "0xe6a7E3d26B898e96fA8bC00fFE6e51b25Dc24d6a"],
    ["BNB Chain", "0xF24199D5D431bE869af3Da61162CbBb58C389324"],
    ["Arbitrum", "0x982Cef8d9F184566C2BeC48c4fb9b6e7B0b4A58B"],
    ["Scroll", "0x06c3c00dc556d2493A661E6a929d3E17f5F097a4"],
    ["opBNB", "0xadd538D8C857072eFC29C4c05F574c68f94137eF"],
    ["Taiko", "0x3760aB354507a29a9F5c65A66C74353fd86393FA"],
    ["Camp", "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"],
    ["Base", "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"],
    ["OKX", "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"],
    ["Sepolia", "0x3760aB354507a29a9F5c65A66C74353fd86393FA"],
    ["Holesky", "0xB3d8DDDc793F75a930313785e5d1612747093f25"],
    ["BNB Chain Testnet", "0xBc074EbE6D39A97Fb35726832300a950e2D94324"],
    ["opBNB Testnet", "0x3760aB354507a29a9F5c65A66C74353fd86393FA"],
    ["Taiko Hekla Testnet", "0x3760aB354507a29a9F5c65A66C74353fd86393FA"],
    ["Scroll Sepolia Testnet", "0x5267380F548EEcA48E57Cd468a66F846e1dEfD6e"],
    ["Base Sepolia Testnet", "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"],
    ["OKX Testnet", "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"],
    ["Monad Testnet", "0x1Ad7fD53206fDc3979C672C0466A1c48AF47B431"],
    ["Pharos Testnet", "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"],
    ["Sophon Testnet", "0x7068da2522c3Ba1f24594ce20E7d7A8EF574E89f"],
    ["Unichain Sepolia Testnet", "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"]
  ];

  checkIncludes(skill, "name: primus-zktls-core-sdk", "SKILL.md frontmatter name is missing.");
  checkIncludes(
    skill,
    "Default all demos and quick-start examples to `proxytls`.",
    "SKILL.md must require proxytls as the default demo path."
  );
  checkIncludes(
    usage,
    'algorithmType: "proxytls"',
    "usage guide must show proxytls examples."
  );
  assert(
    !usage.includes('algorithmType: "mpctls"'),
    "usage guide still contains mpctls example code."
  );
  checkIncludes(
    usage,
    "### Example: choose the Primus contract by chain",
    "usage guide is missing the chain selection example."
  );
  checkIncludes(
    usage,
    "IPrimusZKTLS(primusAddress).verifyAttestation(attestation)",
    "usage guide is missing the direct verification example."
  );

  for (const [network, address] of expectedNetworks) {
    checkIncludes(
      usage,
      `| ${network} | \`${address}\` |`,
      `Missing deployed contract address entry for ${network}.`
    );
  }

  console.log("[ok] Skill frontmatter is present.");
  console.log("[ok] Demo guidance defaults to proxytls.");
  console.log("[ok] Usage guide contains the chain selection example.");
  console.log(`[ok] Verified ${expectedNetworks.length} deployed EVM address entries.`);
}

try {
  run();
} catch (error) {
  console.error(`[error] ${error.message}`);
  process.exit(1);
}
