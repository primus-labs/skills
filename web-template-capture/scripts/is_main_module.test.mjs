import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isMainModule } from "./lib/is_main_module.mjs";

async function makeTempTree() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "is-main-module-"));
  const realDir = path.join(root, "real");
  await fs.mkdir(realDir, { recursive: true });
  const scriptPath = path.join(realDir, "script.mjs");
  await fs.writeFile(scriptPath, "export const marker = true;\n");
  const linkedDir = path.join(root, "link");
  await fs.symlink(realDir, linkedDir, "dir");
  return {
    scriptPath,
    linkedScriptPath: path.join(linkedDir, "script.mjs"),
    otherScriptPath: path.join(realDir, "other.mjs"),
  };
}

test("recognizes a directly executed script", async () => {
  const { scriptPath } = await makeTempTree();
  assert.equal(isMainModule(pathToFileURL(scriptPath).href, scriptPath), true);
});

test("recognizes a script executed through a symlinked directory", async () => {
  const { scriptPath, linkedScriptPath } = await makeTempTree();
  assert.equal(isMainModule(pathToFileURL(scriptPath).href, linkedScriptPath), true);
});

test("rejects a different entry script", async () => {
  const { scriptPath, otherScriptPath } = await makeTempTree();
  assert.equal(isMainModule(pathToFileURL(scriptPath).href, otherScriptPath), false);
});

test("rejects missing arguments and unresolvable paths", async () => {
  const { scriptPath } = await makeTempTree();
  const moduleUrl = pathToFileURL(scriptPath).href;
  assert.equal(isMainModule(moduleUrl, undefined), false);
  assert.equal(isMainModule(undefined, scriptPath), false);
  assert.equal(isMainModule(moduleUrl, path.join(os.tmpdir(), "does-not-exist.mjs")), false);
});
