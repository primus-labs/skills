import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createOkxHeaders,
  fetchJson,
  parseTimeoutMs,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const REQUEST_PATH = "/api/v6/dex/aggregator/quote";
const DEFAULT_CHAIN_INDEX = "1";
const DEFAULT_AMOUNT = "100000000";
const DEFAULT_SWAP_MODE = "exactIn";
const DEFAULT_FROM_TOKEN_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const DEFAULT_TO_TOKEN_ADDRESS = "0xdac17f958d2ee523a2206206994597c13d831ec7";

function parseArgs(argv) {
  const options = {
    chainIndex: process.env.DEMO_SWAP_CHAIN_INDEX || DEFAULT_CHAIN_INDEX,
    amount: process.env.DEMO_SWAP_AMOUNT || DEFAULT_AMOUNT,
    swapMode: process.env.DEMO_SWAP_MODE || DEFAULT_SWAP_MODE,
    fromTokenAddress: process.env.DEMO_SWAP_FROM_TOKEN_ADDRESS || DEFAULT_FROM_TOKEN_ADDRESS,
    toTokenAddress: process.env.DEMO_SWAP_TO_TOKEN_ADDRESS || DEFAULT_TO_TOKEN_ADDRESS,
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
    } else if (arg === "--chain-index") {
      options.chainIndex = argv[i + 1];
      i += 1;
    } else if (arg === "--amount") {
      options.amount = argv[i + 1];
      i += 1;
    } else if (arg === "--swap-mode") {
      options.swapMode = argv[i + 1];
      i += 1;
    } else if (arg === "--from-token-address") {
      options.fromTokenAddress = argv[i + 1];
      i += 1;
    } else if (arg === "--to-token-address") {
      options.toTokenAddress = argv[i + 1];
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
  console.log(`Minimal OKX swap-quote + Primus zkTLS demo

Usage:
  npm run demo:swap-quote -- [options]

Options:
  --chain-index <id>           OKX chain index (default: ${DEFAULT_CHAIN_INDEX})
  --amount <raw>               Raw token amount in base units (default: ${DEFAULT_AMOUNT})
  --swap-mode <mode>           Swap mode, usually exactIn or exactOut (default: ${DEFAULT_SWAP_MODE})
  --from-token-address <addr>  Input token contract address (default: ${DEFAULT_FROM_TOKEN_ADDRESS})
  --to-token-address <addr>    Output token contract address (default: ${DEFAULT_TO_TOKEN_ADDRESS})
  --timeout-ms <ms>            Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch          Skip the plain OKX API request and only run attestation
  --help                       Show this help

Required env vars:
  OKX_API_KEY
  OKX_SECRET_KEY
  OKX_PASSPHRASE
  ZKTLS_APP_ID
  ZKTLS_APP_SECRET
`);
}

function normalizeAddress(address) {
  if (address.startsWith("0x")) {
    return address.toLowerCase();
  }

  return address;
}

function buildRequestPathWithQuery(options) {
  return `${REQUEST_PATH}?${new URLSearchParams({
    chainIndex: options.chainIndex,
    amount: options.amount,
    swapMode: options.swapMode,
    fromTokenAddress: options.fromTokenAddress,
    toTokenAddress: options.toTokenAddress,
  }).toString()}`;
}

function buildAttestationRequest({ url, headers }) {
  return {
    url,
    method: "GET",
    header: headers,
    body: "",
  };
}

function buildResponseResolves() {
  return [
    { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].chainIndex" },
    { keyName: "fromTokenAmount", parseType: "json", parsePath: "$.data[0].fromTokenAmount" },
    { keyName: "toTokenAmount", parseType: "json", parsePath: "$.data[0].toTokenAmount" },
    { keyName: "tradeFee", parseType: "json", parsePath: "$.data[0].tradeFee" },
    { keyName: "estimateGasFee", parseType: "json", parsePath: "$.data[0].estimateGasFee" },
    { keyName: "toToken", parseType: "json", parsePath: "$.data[0].toToken.tokenContractAddress" },
    { keyName: "toTokenSymbol", parseType: "json", parsePath: "$.data[0].toToken.tokenSymbol" },
    { keyName: "priceImpactPercent", parseType: "json", parsePath: "$.data[0].priceImpactPercent" },
  ];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.data?.[0];
  if (!firstRow) {
    return responseJson;
  }

  return {
    code: responseJson.code,
    chainIndex: firstRow.chainIndex,
    fromTokenAmount: firstRow.fromTokenAmount,
    toTokenAmount: firstRow.toTokenAmount,
    tradeFee: firstRow.tradeFee,
    estimateGasFee: firstRow.estimateGasFee,
    priceImpactPercent: firstRow.priceImpactPercent,
    toTokenContractAddress: firstRow.toToken?.tokenContractAddress ?? null,
    toTokenSymbol: firstRow.toToken?.tokenSymbol ?? null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  options.fromTokenAddress = normalizeAddress(options.fromTokenAddress);
  options.toTokenAddress = normalizeAddress(options.toTokenAddress);
  const requestPathWithQuery = buildRequestPathWithQuery(options);
  const url = `https://web3.okx.com${requestPathWithQuery}`;
  const headers = createOkxHeaders({
    method: "GET",
    requestPathWithQuery,
    bodyString: "",
  });

  console.log("Running swap-quote zkTLS demo...");
  console.log(
    JSON.stringify(
      {
        chainIndex: options.chainIndex,
        amount: options.amount,
        swapMode: options.swapMode,
        fromTokenAddress: options.fromTokenAddress,
        toTokenAddress: options.toTokenAddress,
        timeoutMs: options.timeoutMs,
      },
      null,
      2
    )
  );

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url, method: "GET", headers });
    console.log("\nDirect OKX response summary:");
    console.log(JSON.stringify(summarizeDirectResponse(plainResponse), null, 2));
  }

  const { summary } = await startAttestedRequest({
    request: buildAttestationRequest({ url, headers }),
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "okx-swap-quote-demo",
      chainIndex: options.chainIndex,
      amount: options.amount,
      swapMode: options.swapMode,
      fromTokenAddress: options.fromTokenAddress,
      toTokenAddress: options.toTokenAddress,
    },
    timeoutMs: options.timeoutMs,
    userAddress: ZERO_ADDRESS,
  });

  console.log("\nAttestation summary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("\nDemo failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
