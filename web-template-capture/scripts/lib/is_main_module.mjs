import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveRealPath(value) {
  try {
    return fs.realpathSync(value);
  } catch {
    return null;
  }
}

/**
 * Decide whether a script was started directly instead of being imported.
 *
 * Comparing `import.meta.url` with `pathToFileURL(process.argv[1])` is not reliable:
 * Node resolves the symlinked entry path before building `import.meta.url`, so a script
 * started through a symlinked directory (for example `/tmp` on macOS, which links to
 * `/private/tmp`) looks imported and its `main()` never runs.
 */
export function isMainModule(moduleUrl, argvPath) {
  if (!moduleUrl || !argvPath) {
    return false;
  }

  if (moduleUrl === pathToFileURL(argvPath).href) {
    return true;
  }

  const entryPath = resolveRealPath(argvPath);
  if (!entryPath) {
    return false;
  }

  let modulePath;
  try {
    modulePath = resolveRealPath(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }

  return modulePath !== null && modulePath === entryPath;
}
