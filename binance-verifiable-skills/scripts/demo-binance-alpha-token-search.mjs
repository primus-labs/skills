import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  buildPublicRequest,
  fetchJson,
  parseTimeoutMs,
  printJson,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const BASE_URL = "https://web3.binance.com";
const REQUEST_PATH = "/bapi/defi/v5/public/wallet-direct/buw/wallet/market/token/search";
const DEFAULT_KEYWORD = "USDT";
const DEFAULT_CHAIN_IDS = "56";

function parseArgs(argv) {
  const options = {
    keyword: process.env.DEMO_KEYWORD || DEFAULT_KEYWORD,
    chainIds: process.env.DEMO_CHAIN_IDS || DEFAULT_CHAIN_IDS,
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
    } else if (arg === "--keyword") {
      options.keyword = argv[i + 1];
      i += 1;
    } else if (arg === "--chain-ids") {
      options.chainIds = argv[i + 1];
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
  console.log(`Minimal Binance Alpha Token Search + Primus zkTLS demo

Usage:
  npm run demo:alpha-token-search -- [options]

Options:
  --keyword <text>        Search keyword (default: ${DEFAULT_KEYWORD})
  --chain-ids <ids>       Binance Web3 chain IDs, comma-separated (default: ${DEFAULT_CHAIN_IDS})
  --timeout-ms <ms>       Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch     Skip the plain Binance API request and only run attestation
  --help                  Show this help

Required env vars:
  ZKTLS_APP_ID
  ZKTLS_APP_SECRET
`);
}

function buildResponseResolves() {
  return [
    { keyName: "code", parseType: "json", parsePath: "$.code" },
    { keyName: "success", parseType: "json", parsePath: "$.success" },
    { keyName: "symbol", parseType: "json", parsePath: "$.data[0].symbol" },
    { keyName: "name", parseType: "json", parsePath: "$.data[0].name" },
    { keyName: "price", parseType: "json", parsePath: "$.data[0].price" },
    { keyName: "marketCap", parseType: "json", parsePath: "$.data[0].marketCap" },
  ];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.data?.[0];
  if (!firstRow) {
    return responseJson;
  }

  return {
    code: responseJson.code,
    success: responseJson.success,
    symbol: firstRow.symbol,
    name: firstRow.name,
    price: firstRow.price,
    marketCap: firstRow.marketCap,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const request = buildPublicRequest({
    baseUrl: BASE_URL,
    path: REQUEST_PATH,
    params: {
      keyword: options.keyword,
      chainIds: options.chainIds,
      orderBy: "volume24h",
    },
    extraHeaders: {
      "Accept-Encoding": "identity",
      "User-Agent": "binance-web3/1.0 (Skill)",
    },
  });

  console.log("Running Binance alpha-token-search zkTLS demo...");
  console.log(JSON.stringify({ keyword: options.keyword, chainIds: options.chainIds, timeoutMs: options.timeoutMs }, null, 2));

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
      scene: "binance-alpha-token-search-demo",
      keyword: options.keyword,
      chainIds: options.chainIds,
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
