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
const REQUEST_PATH = "/api/v3/account";

function parseArgs(argv) {
  const options = {
    asset: process.env.DEMO_ASSET || "USDT",
    omitZeroBalances: process.env.DEMO_OMIT_ZERO_BALANCES || "false",
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
    } else if (arg === "--omit-zero-balances") {
      options.omitZeroBalances = argv[i + 1];
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
  console.log(`Minimal Binance Spot Asset Balance + Primus zkTLS demo

Usage:
  npm run demo:spot-asset-balance -- [options]

Options:
  --asset <asset>               Spot asset symbol (default: USDT)
  --omit-zero-balances <bool>   Forward omitZeroBalances to Binance (default: false)
  --recv-window <ms>            Binance recvWindow (default: 5000)
  --timeout-ms <ms>             Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch           Skip the plain Binance API request and only run attestation
  --help                        Show this help

Required env vars:
  BINANCE_API_KEY
  BINANCE_API_SECRET
  ZKTLS_APP_ID
  ZKTLS_APP_SECRET
`);
}

function buildResponseResolves(rowIndex) {
  return [
    { keyName: "asset", parseType: "json", parsePath: `$.balances[${rowIndex}].asset` },
    { keyName: "free", parseType: "json", parsePath: `$.balances[${rowIndex}].free` },
    { keyName: "locked", parseType: "json", parsePath: `$.balances[${rowIndex}].locked` },
  ];
}

function summarizeDirectResponse(responseJson, asset) {
  const row = Array.isArray(responseJson?.balances)
    ? responseJson.balances.find((item) => item.asset === asset)
    : null;
  if (!row) {
    return responseJson;
  }
  return {
    asset: row.asset,
    free: row.free,
    locked: row.locked,
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
    params: { omitZeroBalances: options.omitZeroBalances },
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance spot-asset-balance zkTLS demo...");
  console.log(JSON.stringify({ asset, omitZeroBalances: options.omitZeroBalances, recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  let rowIndex = -1;
  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse, asset));
    rowIndex = Array.isArray(plainResponse?.balances)
      ? plainResponse.balances.findIndex((item) => item.asset === asset)
      : -1;
    if (rowIndex < 0) {
      throw new Error(`Asset ${asset} was not found in the spot account balances response.`);
    }
  } else {
    throw new Error("spot-asset-balance currently requires direct fetch so the asset row can be resolved into a stable array index.");
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(rowIndex),
    additionParams: { scene: "binance-spot-asset-balance-demo", asset },
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
