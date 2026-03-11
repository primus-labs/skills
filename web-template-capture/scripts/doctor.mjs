import process from "node:process";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK: ${message}`);
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 18) {
    fail(`Node.js 18+ is required. Current version: ${process.versions.node}`);
  } else {
    pass(`Node.js ${process.versions.node}`);
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
    pass("Playwright dependency is installed");
  } catch {
    fail("Playwright is missing. Run: npm install");
    return;
  }

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    pass("Chrome launch check passed");
  } catch (chromeError) {
    try {
      browser = await chromium.launch({ headless: true });
      pass("Chromium launch check passed");
      console.warn(`WARN: Chrome launch failed, fell back to Chromium: ${chromeError.message.split("\n")[0]}`);
    } catch (chromiumError) {
      fail(
        `No usable browser was found. Install one with: npx playwright install chromium. Last error: ${chromiumError.message.split("\n")[0]}`
      );
    }
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  fail(error.message);
});
