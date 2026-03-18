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
const REQUEST_PATH = "/sapi/v1/account/apiTradingStatus";

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
  console.log(`Minimal Binance Spot API Trading Status + Primus zkTLS demo

Usage:
  npm run demo:spot-api-trading-status -- [options]

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
    { keyName: "isLocked", parseType: "json", parsePath: "$.data.isLocked" },
    { keyName: "plannedRecoverTime", parseType: "json", parsePath: "$.data.plannedRecoverTime" },
    { keyName: "triggerConditionUFR", parseType: "json", parsePath: "$.data.triggerCondition.UFR" },
    { keyName: "triggerConditionIFER", parseType: "json", parsePath: "$.data.triggerCondition.IFER" },
    { keyName: "triggerConditionGCR", parseType: "json", parsePath: "$.data.triggerCondition.GCR" },
    { keyName: "updateTime", parseType: "json", parsePath: "$.data.updateTime" },
  ];
}

function summarizeDirectResponse(responseJson) {
  return {
    isLocked: responseJson?.data?.isLocked,
    plannedRecoverTime: responseJson?.data?.plannedRecoverTime,
    triggerConditionUFR: responseJson?.data?.triggerCondition?.UFR,
    triggerConditionIFER: responseJson?.data?.triggerCondition?.IFER,
    triggerConditionGCR: responseJson?.data?.triggerCondition?.GCR,
    updateTime: responseJson?.data?.updateTime,
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

  console.log("Running Binance spot-api-trading-status zkTLS demo...");
  console.log(JSON.stringify({ recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse));
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: { scene: "binance-spot-api-trading-status-demo" },
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
