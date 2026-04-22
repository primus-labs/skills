import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createOkxHeaders,
  fetchJson,
  parseTimeoutMs,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const REQUEST_PATH = "/api/v6/dex/market/price";
const REQUEST_URL = `https://web3.okx.com${REQUEST_PATH}`;
const DEFAULT_CHAIN_INDEX = "1";
const DEFAULT_TOKEN_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function parseArgs(argv) {
  const options = {
    chainIndex: process.env.DEMO_CHAIN_INDEX || DEFAULT_CHAIN_INDEX,
    tokenAddress: process.env.DEMO_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS,
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
  console.log(`Minimal OKX + Primus zkTLS demo

Usage:
  npm run demo:market-price -- [options]

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

function normalizeTokenAddress(tokenAddress) {
  if (tokenAddress.startsWith("0x")) {
    return tokenAddress.toLowerCase();
  }
  return tokenAddress;
}

function buildAttestationRequest({ headers, body }) {
  return {
    url: REQUEST_URL,
    method: "POST",
    header: headers,
    body,
  };
}

function buildResponseResolves() {
  return [
    { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].chainIndex" },
    { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenContractAddress" },
    { keyName: "time", parseType: "json", parsePath: "$.data[0].time" },
    { keyName: "price", parseType: "json", parsePath: "$.data[0].price" },
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
    time: firstRow.time,
    price: firstRow.price,
  };
}

function summarizeAttestation(attestation, localVerification) {
  return {
    localVerification,
    recipient: attestation.recipient,
    request: attestation.request,
    attestors: attestation.attestors,
    signatures: attestation.signatures?.length || 0,
    timestamp: attestation.timestamp,
    dataPreview: attestation.data,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const chainIndex = options.chainIndex;
  const tokenAddress = normalizeTokenAddress(options.tokenAddress);
  const body = [
    {
      chainIndex,
      tokenContractAddress: tokenAddress,
    },
  ];
  const bodyString = JSON.stringify(body);
  const headers = createOkxHeaders({
    method: "POST",
    requestPathWithQuery: REQUEST_PATH,
    bodyString,
    contentType: "application/json",
  });

  console.log("Running market-price zkTLS demo...");
  console.log(JSON.stringify({ chainIndex, tokenAddress, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({
      url: REQUEST_URL,
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
      scene: "okx-market-price-demo",
      chainIndex,
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
