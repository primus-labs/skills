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

const BASE_URL = "https://fapi.binance.com";
const REQUEST_PATH = "/fapi/v3/balance";

function parseArgs(argv) {
  const options = {
    asset: process.env.DEMO_ASSET || "USDT",
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
    } else if (arg === "--asset") {
      options.asset = argv[i + 1];
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
  console.log(`Minimal Binance Futures Balance + Primus zkTLS demo

Usage:
  npm run demo:futures-balance -- [options]

Options:
  --asset <asset>          Futures balance asset to filter after fetch (default: USDT)
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
    { keyName: "asset", parseType: "json", parsePath: `$[${rowIndex}].asset` },
    { keyName: "balance", parseType: "json", parsePath: `$[${rowIndex}].balance` },
    { keyName: "crossWalletBalance", parseType: "json", parsePath: `$[${rowIndex}].crossWalletBalance` },
    { keyName: "crossUnPnl", parseType: "json", parsePath: `$[${rowIndex}].crossUnPnl` },
    { keyName: "availableBalance", parseType: "json", parsePath: `$[${rowIndex}].availableBalance` },
  ];
}

function summarizeDirectResponse(responseJson, asset) {
  const row = Array.isArray(responseJson) ? responseJson.find((item) => item.asset === asset) : null;
  if (!row) {
    return responseJson;
  }
  return {
    asset: row.asset,
    balance: row.balance,
    crossWalletBalance: row.crossWalletBalance,
    crossUnPnl: row.crossUnPnl,
    availableBalance: row.availableBalance,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const asset = String(options.asset).toUpperCase();
  const request = createSignedRequest({
    baseUrl: BASE_URL,
    path: REQUEST_PATH,
    params: {},
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance futures-balance zkTLS demo...");
  console.log(JSON.stringify({ asset, recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  let resolvedRowIndex = null;
  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse, asset));
    resolvedRowIndex = Array.isArray(plainResponse) ? plainResponse.findIndex((item) => item.asset === asset) : -1;
    if (resolvedRowIndex < 0) {
      throw new Error(`Asset ${asset} was not found in the futures balance response.`);
    }
  } else {
    throw new Error("futures-balance currently requires direct fetch so the asset row can be resolved into a stable array index.");
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(resolvedRowIndex),
    additionParams: { scene: "binance-futures-balance-demo", asset },
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
