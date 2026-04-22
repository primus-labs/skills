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
const REQUEST_PATH = "/api/v3/klines";
const DEFAULT_SYMBOL = "BTCUSDT";
const DEFAULT_INTERVAL = "1h";
const DEFAULT_LIMIT = "1";

function parseArgs(argv) {
  const options = {
    symbol: process.env.DEMO_SYMBOL || DEFAULT_SYMBOL,
    interval: process.env.DEMO_INTERVAL || DEFAULT_INTERVAL,
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
    } else if (arg === "--interval") {
      options.interval = argv[i + 1];
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
  console.log(`Minimal Binance Spot Klines + Primus zkTLS demo

Usage:
  npm run demo:spot-klines -- [options]

Options:
  --symbol <symbol>        Trading pair symbol (default: ${DEFAULT_SYMBOL})
  --interval <interval>    Binance kline interval (default: ${DEFAULT_INTERVAL})
  --limit <n>              Number of candles. First release should keep this at 1 (default: ${DEFAULT_LIMIT})
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
    { keyName: "openTime", parseType: "json", parsePath: "$[0][0]" },
    { keyName: "open", parseType: "json", parsePath: "$[0][1]" },
    { keyName: "high", parseType: "json", parsePath: "$[0][2]" },
    { keyName: "low", parseType: "json", parsePath: "$[0][3]" },
    { keyName: "close", parseType: "json", parsePath: "$[0][4]" },
    { keyName: "volume", parseType: "json", parsePath: "$[0][5]" },
    { keyName: "closeTime", parseType: "json", parsePath: "$[0][6]" },
  ];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.[0];
  if (!firstRow) {
    return responseJson;
  }

  return {
    openTime: firstRow[0],
    open: firstRow[1],
    high: firstRow[2],
    low: firstRow[3],
    close: firstRow[4],
    volume: firstRow[5],
    closeTime: firstRow[6],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const symbol = normalizeSymbol(options.symbol);
  const request = buildPublicRequest({
    baseUrl: BASE_URL,
    path: REQUEST_PATH,
    params: {
      symbol,
      interval: options.interval,
      limit: options.limit,
    },
  });

  console.log("Running Binance spot-klines zkTLS demo...");
  console.log(JSON.stringify({ symbol, interval: options.interval, limit: options.limit, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({
      url: request.url,
      method: request.method,
      headers: request.header,
      body: request.body,
    });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse));
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "binance-spot-klines-demo",
      symbol,
      interval: options.interval,
      limit: options.limit,
    },
    proofType: "verifiable",
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
