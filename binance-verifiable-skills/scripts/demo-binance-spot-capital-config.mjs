import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createSignedRequest,
  fetchJson,
  parseTimeoutMs,
  printJson,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const BASE_URL = "https://api.binance.com";
const REQUEST_PATH = "/sapi/v1/capital/config/getall";

function parseArgs(argv) {
  const options = {
    coin: process.env.DEMO_COIN || "USDT",
    recvWindow: process.env.DEMO_RECV_WINDOW || "5000",
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
    } else if (arg === "--coin") {
      options.coin = argv[i + 1];
      i += 1;
    } else if (arg === "--recv-window") {
      options.recvWindow = argv[i + 1];
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
  console.log(`Minimal Binance Spot Capital Config + Primus zkTLS demo

Usage:
  npm run demo:spot-capital-config -- [options]

Options:
  --coin <coin>            Coin symbol to locate (default: USDT)
  --recv-window <ms>       Binance recvWindow (default: 5000)
  --timeout-ms <ms>        Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch      Skip the plain Binance API request and only run attestation
  --help                   Show this help

Required env vars:
  BINANCE_API_KEY
  BINANCE_API_SECRET
  ZKTLS_APP_ID
  ZKTLS_APP_SECRET
`);
}

function buildResponseResolves(rowIndex) {
  return [
    { keyName: "coin", parseType: "json", parsePath: `$[${rowIndex}].coin` },
    { keyName: "name", parseType: "json", parsePath: `$[${rowIndex}].name` },
    { keyName: "free", parseType: "json", parsePath: `$[${rowIndex}].free` },
    { keyName: "depositAllEnable", parseType: "json", parsePath: `$[${rowIndex}].depositAllEnable` },
    { keyName: "withdrawAllEnable", parseType: "json", parsePath: `$[${rowIndex}].withdrawAllEnable` },
    { keyName: "trading", parseType: "json", parsePath: `$[${rowIndex}].trading` },
  ];
}

function summarizeDirectResponse(responseJson, coin) {
  const row = Array.isArray(responseJson) ? responseJson.find((item) => item.coin === coin) : null;
  if (!row) {
    return responseJson;
  }
  return {
    coin: row.coin,
    name: row.name,
    free: row.free,
    depositAllEnable: row.depositAllEnable,
    withdrawAllEnable: row.withdrawAllEnable,
    trading: row.trading,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const coin = String(options.coin).toUpperCase();
  const request = createSignedRequest({
    baseUrl: BASE_URL,
    path: REQUEST_PATH,
    params: {},
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance spot-capital-config zkTLS demo...");
  console.log(JSON.stringify({ coin, recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  let rowIndex = -1;
  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse, coin));
    rowIndex = Array.isArray(plainResponse) ? plainResponse.findIndex((item) => item.coin === coin) : -1;
    if (rowIndex < 0) {
      throw new Error(`Coin ${coin} was not found in the capital config response.`);
    }
  } else {
    throw new Error("spot-capital-config currently requires direct fetch so the coin row can be resolved into a stable array index.");
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(rowIndex),
    additionParams: { scene: "binance-spot-capital-config-demo", coin },
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
