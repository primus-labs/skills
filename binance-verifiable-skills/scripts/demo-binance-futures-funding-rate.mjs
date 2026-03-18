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

const BASE_URL = "https://fapi.binance.com";
const REQUEST_PATH = "/fapi/v1/fundingRate";
const DEFAULT_SYMBOL = "BTCUSDT";
const DEFAULT_LIMIT = "1";

function parseArgs(argv) {
  const options = {
    symbol: process.env.DEMO_SYMBOL || DEFAULT_SYMBOL,
    limit: process.env.DEMO_LIMIT || DEFAULT_LIMIT,
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
    } else if (arg === "--limit") {
      options.limit = argv[i + 1];
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
  console.log(`Minimal Binance Futures Funding Rate + Primus zkTLS demo

Usage:
  npm run demo:futures-funding-rate -- [options]

Options:
  --symbol <symbol>        Futures trading pair symbol (default: ${DEFAULT_SYMBOL})
  --limit <n>              Number of rows, keep this small (default: ${DEFAULT_LIMIT})
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
    { keyName: "symbol", parseType: "json", parsePath: "$[0].symbol" },
    { keyName: "fundingRate", parseType: "json", parsePath: "$[0].fundingRate" },
    { keyName: "fundingTime", parseType: "json", parsePath: "$[0].fundingTime" },
    { keyName: "markPrice", parseType: "json", parsePath: "$[0].markPrice" },
  ];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.[0];
  if (!firstRow) {
    return responseJson;
  }
  return firstRow;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const symbol = normalizeSymbol(options.symbol);
  const request = buildPublicRequest({ baseUrl: BASE_URL, path: REQUEST_PATH, params: { symbol, limit: options.limit } });
  console.log("Running Binance futures-funding-rate zkTLS demo...");
  console.log(JSON.stringify({ symbol, limit: options.limit, timeoutMs: options.timeoutMs }, null, 2));
  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse));
  }
  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: { scene: "binance-futures-funding-rate-demo", symbol, limit: options.limit },
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
