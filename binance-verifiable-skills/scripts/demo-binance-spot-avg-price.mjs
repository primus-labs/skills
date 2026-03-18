import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  buildPublicRequest,
  fetchJson,
  normalizeSymbol,
  parseTimeoutMs,
  printJson,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const BASE_URL = "https://api.binance.com";
const REQUEST_PATH = "/api/v3/avgPrice";
const DEFAULT_SYMBOL = "BTCUSDT";

function parseArgs(argv) {
  const options = {
    symbol: process.env.DEMO_SYMBOL || DEFAULT_SYMBOL,
    timeoutMs: parseTimeoutMs(process.env.DEMO_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    skipDirectFetch: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--skip-direct-fetch") {
      options.skipDirectFetch = true;
    } else if (arg === "--symbol") {
      options.symbol = argv[i + 1];
      i += 1;
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parseTimeoutMs(argv[i + 1]);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Minimal Binance Spot Average Price + Primus zkTLS demo

Usage:
  npm run demo:spot-avg-price -- [options]

Options:
  --symbol <symbol>        Trading pair symbol (default: ${DEFAULT_SYMBOL})
  --timeout-ms <ms>        Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch      Skip the plain Binance API request and only run attestation
  --help                   Show this help

Required env vars:
  ZKTLS_APP_ID
  ZKTLS_APP_SECRET
`);
}

function buildResponseResolves() {
  return [
    { keyName: "mins", parseType: "json", parsePath: "$.mins" },
    { keyName: "price", parseType: "json", parsePath: "$.price" },
    { keyName: "closeTime", parseType: "json", parsePath: "$.closeTime" },
  ];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const symbol = normalizeSymbol(options.symbol);
  const request = buildPublicRequest({ baseUrl: BASE_URL, path: REQUEST_PATH, params: { symbol } });
  console.log("Running Binance spot-avg-price zkTLS demo...");
  console.log(JSON.stringify({ symbol, timeoutMs: options.timeoutMs }, null, 2));
  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", plainResponse);
  }
  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: { scene: "binance-spot-avg-price-demo", symbol },
    timeoutMs: options.timeoutMs,
    userAddress: ZERO_ADDRESS,
  });
  printJson("Attestation summary", summary);
}

main().catch((error) => {
  console.error("\nDemo failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
