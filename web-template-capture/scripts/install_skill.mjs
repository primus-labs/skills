import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = path.join(os.homedir(), ".codex", "skills", "web-template-capture");

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args) {
  const result = spawnSync(commandName(command), args, {
    cwd: targetDir,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(skillDir, targetDir, { recursive: true });

  console.log(`Installed skill files to ${targetDir}`);
  console.log("Installing dependencies inside the Codex skill directory...");
  run("npm", ["install"]);
  run("npx", ["playwright", "install", "chromium"]);
  run("node", ["scripts/doctor.mjs"]);
  console.log("web-template-capture is ready to use in Codex.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
