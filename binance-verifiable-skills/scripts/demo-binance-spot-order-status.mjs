import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createSignedRequest,
  fetchJson,
  normalizeSymbol,
  parseTimeoutMs,
  printJson,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const BASE_URL = "https://api.binance.com";
const REQUEST_PATH = "/api/v3/order";

function parseArgs(argv) {
  const options = {
    symbol: process.env.DEMO_SYMBOL,
    orderId: process.env.DEMO_ORDER_ID,
    origClientOrderId: process.env.DEMO_ORIG_CLIENT_ORDER_ID,
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
    } else if (arg === "--symbol") {
      options.symbol = argv[i + 1];
      i += 1;
    } else if (arg === "--order-id") {
      options.orderId = argv[i + 1];
      i += 1;
    } else if (arg === "--orig-client-order-id") {
      options.origClientOrderId = argv[i + 1];
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
  console.log(`Minimal Binance Spot Order Status + Primus zkTLS demo

Usage:
  npm run demo:spot-order-status -- [options]

Options:
  --symbol <symbol>                Trading pair symbol
  --order-id <id>                  Binance orderId
  --orig-client-order-id <id>      Binance origClientOrderId
  --recv-window <ms>               Binance recvWindow (default: 5000)
  --timeout-ms <ms>                Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch              Skip the plain Binance API request and only run attestation
  --help                           Show this help

Required env vars:
  BINANCE_API_KEY
  BINANCE_API_SECRET
  ZKTLS_APP_ID
  ZKTLS_APP_SECRET
`);
}

function buildResponseResolves() {
  return [
    { keyName: "symbol", parseType: "json", parsePath: "$.symbol" },
    { keyName: "orderId", parseType: "json", parsePath: "$.orderId" },
    { keyName: "status", parseType: "json", parsePath: "$.status" },
    { keyName: "side", parseType: "json", parsePath: "$.side" },
    { keyName: "type", parseType: "json", parsePath: "$.type" },
    { keyName: "price", parseType: "json", parsePath: "$.price" },
    { keyName: "origQty", parseType: "json", parsePath: "$.origQty" },
    { keyName: "executedQty", parseType: "json", parsePath: "$.executedQty" },
    { keyName: "time", parseType: "json", parsePath: "$.time" },
  ];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.symbol) {
    throw new Error("symbol is required");
  }
  if (!options.orderId && !options.origClientOrderId) {
    throw new Error("either order-id or orig-client-order-id is required");
  }

  const symbol = normalizeSymbol(options.symbol);
  const request = createSignedRequest({
    baseUrl: BASE_URL,
    path: REQUEST_PATH,
    params: {
      symbol,
      orderId: options.orderId,
      origClientOrderId: options.origClientOrderId,
    },
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance spot-order-status zkTLS demo...");
  console.log(JSON.stringify({ symbol, orderId: options.orderId, origClientOrderId: options.origClientOrderId, recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({
      url: request.url,
      method: request.method,
      headers: request.header,
      body: request.body,
    });
    printJson("Direct Binance response summary", plainResponse);
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "binance-spot-order-status-demo",
      symbol,
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
