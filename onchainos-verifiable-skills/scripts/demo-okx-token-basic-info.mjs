import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createOkxHeaders,
  fetchJson,
  parseTimeoutMs,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const REQUEST_PATH = "/api/v6/dex/market/token/basic-info";
const DEFAULT_CHAIN_INDEX = "501";
const DEFAULT_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";

function parseArgs(argv) {
  const options = {
    chainIndex: process.env.DEMO_BASIC_INFO_CHAIN_INDEX || DEFAULT_CHAIN_INDEX,
    tokenAddress: process.env.DEMO_BASIC_INFO_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS,
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
  console.log(`Minimal OKX token-basic-info + Primus zkTLS demo

Usage:
  npm run demo:token-basic-info -- [options]

Options:
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
    { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].chainIndex" },
    { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenContractAddress" },
    { keyName: "name", parseType: "json", parsePath: "$.data[0].tokenName" },
    { keyName: "symbol", parseType: "json", parsePath: "$.data[0].tokenSymbol" },
    { keyName: "decimal", parseType: "json", parsePath: "$.data[0].decimal" },
    { keyName: "communityRecognized", parseType: "json", parsePath: "$.data[0].tagList.communityRecognized" },
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
    tokenContractAddress: firstRow.tokenContractAddress,
    tokenName: firstRow.tokenName,
    tokenSymbol: firstRow.tokenSymbol,
    decimal: firstRow.decimal,
    communityRecognized: firstRow.tagList?.communityRecognized ?? null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const body = [
    {
      chainIndex: options.chainIndex,
      tokenContractAddress: options.tokenAddress,
    },
  ];
  const bodyString = JSON.stringify(body);
  const headers = createOkxHeaders({
    method: "POST",
    requestPathWithQuery: REQUEST_PATH,
    bodyString,
    contentType: "application/json",
  });

  console.log("Running token-basic-info zkTLS demo...");
  console.log(JSON.stringify({ chainIndex: options.chainIndex, tokenAddress: options.tokenAddress, timeoutMs: options.timeoutMs }, null, 2));

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
      scene: "okx-token-basic-info-demo",
      chainIndex: options.chainIndex,
      tokenAddress: options.tokenAddress,
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
