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
    omitZeroBalances: process.env.DEMO_OMIT_ZERO_BALANCES || "true",
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
  console.log(`Minimal Binance Spot Account + Primus zkTLS demo

Usage:
  npm run demo:spot-account -- [options]

Options:
  --omit-zero-balances <bool>  Forward omitZeroBalances to Binance (default: true)
  --recv-window <ms>           Binance recvWindow (default: 5000)
  --timeout-ms <ms>            Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch          Skip the plain Binance API request and only run attestation
  --help                       Show this help

Required env vars:
  BINANCE_API_KEY
  BINANCE_API_SECRET
  ZKTLS_APP_ID
  ZKTLS_APP_SECRET
`);
}

function buildResponseResolves() {
  return [
    { keyName: "makerCommission", parseType: "json", parsePath: "$.makerCommission" },
    { keyName: "takerCommission", parseType: "json", parsePath: "$.takerCommission" },
    { keyName: "canTrade", parseType: "json", parsePath: "$.canTrade" },
    { keyName: "canWithdraw", parseType: "json", parsePath: "$.canWithdraw" },
    { keyName: "canDeposit", parseType: "json", parsePath: "$.canDeposit" },
    { keyName: "accountType", parseType: "json", parsePath: "$.accountType" },
    { keyName: "updateTime", parseType: "json", parsePath: "$.updateTime" },
  ];
}

function summarizeDirectResponse(responseJson) {
  return {
    makerCommission: responseJson?.makerCommission,
    takerCommission: responseJson?.takerCommission,
    canTrade: responseJson?.canTrade,
    canWithdraw: responseJson?.canWithdraw,
    canDeposit: responseJson?.canDeposit,
    accountType: responseJson?.accountType,
    updateTime: responseJson?.updateTime,
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
    params: { omitZeroBalances: options.omitZeroBalances },
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance spot-account zkTLS demo...");
  console.log(JSON.stringify({ omitZeroBalances: options.omitZeroBalances, recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

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
      scene: "binance-spot-account-demo",
      omitZeroBalances: options.omitZeroBalances,
    },
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
