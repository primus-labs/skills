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

const BASE_URL = "https://fapi.binance.com";
const REQUEST_PATH = "/fapi/v3/positionRisk";

function parseArgs(argv) {
  const options = {
    symbol: process.env.DEMO_SYMBOL,
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
  console.log(`Minimal Binance Futures Position Risk + Primus zkTLS demo

Usage:
  npm run demo:futures-position-risk -- [options]

Options:
  --symbol <symbol>        Futures trading pair symbol
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
    { keyName: "symbol", parseType: "json", parsePath: "$[0].symbol" },
    { keyName: "positionAmt", parseType: "json", parsePath: "$[0].positionAmt" },
    { keyName: "entryPrice", parseType: "json", parsePath: "$[0].entryPrice" },
    { keyName: "markPrice", parseType: "json", parsePath: "$[0].markPrice" },
    { keyName: "unRealizedProfit", parseType: "json", parsePath: "$[0].unRealizedProfit" },
    { keyName: "liquidationPrice", parseType: "json", parsePath: "$[0].liquidationPrice" },
    { keyName: "leverage", parseType: "json", parsePath: "$[0].leverage" },
    { keyName: "positionSide", parseType: "json", parsePath: "$[0].positionSide" },
  ];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.[0];
  if (!firstRow) {
    return responseJson;
  }

  return {
    symbol: firstRow.symbol,
    positionAmt: firstRow.positionAmt,
    entryPrice: firstRow.entryPrice,
    markPrice: firstRow.markPrice,
    unRealizedProfit: firstRow.unRealizedProfit,
    liquidationPrice: firstRow.liquidationPrice,
    leverage: firstRow.leverage,
    positionSide: firstRow.positionSide,
  };
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

  const symbol = normalizeSymbol(options.symbol);
  const request = createSignedRequest({
    baseUrl: BASE_URL,
    path: REQUEST_PATH,
    params: { symbol },
    recvWindow: options.recvWindow,
  });

  console.log("Running Binance futures-position-risk zkTLS demo...");
  console.log(JSON.stringify({ symbol, recvWindow: options.recvWindow, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({
      url: request.url,
      method: request.method,
      headers: request.header,
      body: request.body,
    });
    printJson("Direct Binance response summary", summarizeDirectResponse(plainResponse));
    if (!Array.isArray(plainResponse) || plainResponse.length === 0) {
      throw new Error(`No position-risk row returned for symbol ${symbol}. Open or select a symbol with an existing futures position before requesting attestation.`);
    }
  }

  const { summary } = await startAttestedRequest({
    request,
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "binance-futures-position-risk-demo",
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
