import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createOkxHeaders,
  fetchJson,
  parseTimeoutMs,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const REQUEST_PATH = "/api/v6/dex/balance/token-balances-by-address";
const DEFAULT_WALLET_ADDRESS = "0x28C6c06298d514Db089934071355E5743bf21d60";
const DEFAULT_CHAIN_INDEX = "1";
const DEFAULT_TOKEN_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

function parseArgs(argv) {
  const options = {
    address: process.env.DEMO_WALLET_ADDRESS || DEFAULT_WALLET_ADDRESS,
    chainIndex: process.env.DEMO_WALLET_CHAIN_INDEX || DEFAULT_CHAIN_INDEX,
    tokenAddress: process.env.DEMO_WALLET_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS,
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
    } else if (arg === "--address") {
      options.address = argv[i + 1];
      i += 1;
    } else if (arg === "--chain-index") {
      options.chainIndex = argv[i + 1];
      i += 1;
    } else if (arg === "--token-address") {
      options.tokenAddress = argv[i + 1];
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
  console.log(`Minimal OKX wallet token-balance + Primus zkTLS demo

Usage:
  npm run demo:wallet-token-balance -- [options]

Options:
  --address <wallet>       Wallet address to inspect (default: ${DEFAULT_WALLET_ADDRESS})
  --chain-index <id>       OKX chain index (default: ${DEFAULT_CHAIN_INDEX})
  --token-address <addr>   Token contract address (default: ${DEFAULT_TOKEN_ADDRESS})
  --timeout-ms <ms>        Attestation timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --skip-direct-fetch      Skip the plain OKX API request and only run attestation
  --help                   Show this help

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

function buildAttestationRequest({ headers, body }) {
  return {
    url: `https://web3.okx.com${REQUEST_PATH}`,
    method: "POST",
    header: headers,
    body,
  };
}

function buildResponseResolves() {
  return [
    { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].tokenAssets[0].chainIndex" },
    { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenAssets[0].tokenContractAddress" },
    { keyName: "symbol", parseType: "json", parsePath: "$.data[0].tokenAssets[0].symbol" },
    { keyName: "balance", parseType: "json", parsePath: "$.data[0].tokenAssets[0].balance" },
    { keyName: "tokenPrice", parseType: "json", parsePath: "$.data[0].tokenAssets[0].tokenPrice" },
    { keyName: "isRiskToken", parseType: "json", parsePath: "$.data[0].tokenAssets[0].isRiskToken" },
  ];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.data?.[0]?.tokenAssets?.[0];
  if (!firstRow) {
    return responseJson;
  }

  return {
    code: responseJson.code,
    address: firstRow.address,
    chainIndex: firstRow.chainIndex,
    tokenContractAddress: firstRow.tokenContractAddress,
    symbol: firstRow.symbol,
    balance: firstRow.balance,
    tokenPrice: firstRow.tokenPrice,
    isRiskToken: firstRow.isRiskToken,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const address = normalizeAddress(options.address);
  const tokenAddress = normalizeAddress(options.tokenAddress);
  const body = {
    address,
    tokenContractAddresses: [
      {
        chainIndex: options.chainIndex,
        tokenContractAddress: tokenAddress,
      },
    ],
  };
  const bodyString = JSON.stringify(body);
  const headers = createOkxHeaders({
    method: "POST",
    requestPathWithQuery: REQUEST_PATH,
    bodyString,
    contentType: "application/json",
  });

  console.log("Running wallet-token-balance zkTLS demo...");
  console.log(
    JSON.stringify(
      {
        address,
        chainIndex: options.chainIndex,
        tokenAddress,
        timeoutMs: options.timeoutMs,
      },
      null,
      2
    )
  );

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({
      url: `https://web3.okx.com${REQUEST_PATH}`,
      method: "POST",
      headers,
      body: bodyString,
    });
    console.log("\nDirect OKX response summary:");
    console.log(JSON.stringify(summarizeDirectResponse(plainResponse), null, 2));
  }

  const { summary } = await startAttestedRequest({
    request: buildAttestationRequest({ headers, body }),
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "okx-wallet-token-balance-demo",
      address,
      chainIndex: options.chainIndex,
      tokenAddress,
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
