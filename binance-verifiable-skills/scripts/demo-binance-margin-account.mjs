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
const REQUEST_PATH = "/sapi/v1/margin/account";

function parseArgs(argv) {
  const options = {
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
  console.log(`Minimal Binance Margin Account + Primus zkTLS demo

Usage:
  npm run demo:margin-account -- [options]

Options:
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

function buildResponseResolves() {
  return [
    { keyName: "borrowEnabled", parseType: "json", parsePath: "$.borrowEnabled" },
    { keyName: "tradeEnabled", parseType: "json", parsePath: "$.tradeEnabled" },
    { keyName: "transferEnabled", parseType: "json", parsePath: "$.transferEnabled" },
    { keyName: "marginLevel", parseType: "json", parsePath: "$.marginLevel" },
    { keyName: "totalAssetOfBtc", parseType: "json", parsePath: "$.totalAssetOfBtc" },
    { keyName: "totalLiabilityOfBtc", parseType: "json", parsePath: "$.totalLiabilityOfBtc" },
    { keyName: "totalNetAssetOfBtc", parseType: "json", parsePath: "$.totalNetAssetOfBtc" },
  ];
}

function summarizeDirectResponse(responseJson) {
  return {
    borrowEnabled: responseJson?.borrowEnabled,
    tradeEnabled: responseJson?.tradeEnabled,
    transferEnabled: responseJson?.transferEnabled,
    marginLevel: responseJson?.marginLevel,
    totalAssetOfBtc: responseJson?.totalAssetOfBtc,
    totalLiabilityOfBtc: responseJson?.totalLiabilityOfBtc,
    totalNetAssetOfBtc: responseJson?.totalNetAssetOfBtc,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const request = createSignedRequest({
    baseUrl: BASE_URL,
    path: REQUEST_PATH,
    params: {},
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance margin-account zkTLS demo...");
  console.log(JSON.stringify({ recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse));
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: { scene: "binance-margin-account-demo" },
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
