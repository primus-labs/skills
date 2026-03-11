import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args) {
  const result = spawnSync(commandName(command), args, {
    cwd: skillDir,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Installing web-template-capture dependencies...");
run("npm", ["install"]);

console.log("Installing Playwright Chromium...");
run("npx", ["playwright", "install", "chromium"]);

console.log("Running environment checks...");
run("node", ["scripts/doctor.mjs"]);
