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
const REQUEST_PATH = "/sapi/v1/margin/maxBorrowable";

function parseArgs(argv) {
  const options = {
    asset: process.env.DEMO_ASSET || "USDT",
    isolatedSymbol: process.env.DEMO_ISOLATED_SYMBOL,
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
    } else if (arg === "--isolated-symbol") {
      options.isolatedSymbol = argv[i + 1];
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
  console.log(`Minimal Binance Margin Max Borrowable + Primus zkTLS demo

Usage:
  npm run demo:margin-max-borrowable -- [options]

Options:
  --asset <asset>              Margin asset (default: USDT)
  --isolated-symbol <symbol>   Optional isolated symbol
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
    { keyName: "amount", parseType: "json", parsePath: "$.amount" },
    { keyName: "borrowLimit", parseType: "json", parsePath: "$.borrowLimit" },
  ];
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
    params: {
      asset,
      isolatedSymbol: options.isolatedSymbol,
    },
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance margin-max-borrowable zkTLS demo...");
  console.log(JSON.stringify({ asset, isolatedSymbol: options.isolatedSymbol || null, recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url: request.url, method: request.method, headers: request.header, body: request.body });
    printJson("Direct Binance response summary", plainResponse);
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: { scene: "binance-margin-max-borrowable-demo", asset },
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
