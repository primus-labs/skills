import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createOkxHeaders,
  fetchJson,
  parseTimeoutMs,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const REQUEST_PATH = "/api/v6/dex/balance/total-value-by-address";
const DEFAULT_ADDRESS = "0x28C6c06298d514Db089934071355E5743bf21d60";
const DEFAULT_CHAINS = "1";
const DEFAULT_ASSET_TYPE = "0";

function parseArgs(argv) {
  const options = {
    address: process.env.DEMO_WALLET_TOTAL_ADDRESS || DEFAULT_ADDRESS,
    chains: process.env.DEMO_WALLET_TOTAL_CHAINS || DEFAULT_CHAINS,
    assetType: process.env.DEMO_WALLET_TOTAL_ASSET_TYPE || DEFAULT_ASSET_TYPE,
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
    } else if (arg === "--chains") {
      options.chains = argv[i + 1];
      i += 1;
    } else if (arg === "--asset-type") {
      options.assetType = argv[i + 1];
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
  console.log(`Minimal OKX wallet-total-value + Primus zkTLS demo

Usage:
  npm run demo:wallet-total-value -- [options]

Options:
  --address <wallet>       Wallet address to inspect (default: ${DEFAULT_ADDRESS})
  --chains <ids>           Comma-separated OKX chain indices (default: ${DEFAULT_CHAINS})
  --asset-type <type>      Asset type filter (default: ${DEFAULT_ASSET_TYPE})
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

function buildRequestPathWithQuery(options) {
  return `${REQUEST_PATH}?${new URLSearchParams({
    address: options.address.toLowerCase(),
    chains: options.chains,
    assetType: options.assetType,
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
  return [{ keyName: "totalValue", parseType: "json", parsePath: "$.data[0].totalValue" }];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.data?.[0];
  if (!firstRow) {
    return responseJson;
  }

  return {
    code: responseJson.code,
    totalValue: firstRow.totalValue,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const requestPathWithQuery = buildRequestPathWithQuery(options);
  const url = `https://web3.okx.com${requestPathWithQuery}`;
  const headers = createOkxHeaders({
    method: "GET",
    requestPathWithQuery,
    bodyString: "",
  });

  console.log("Running wallet-total-value zkTLS demo...");
  console.log(JSON.stringify({ address: options.address.toLowerCase(), chains: options.chains, assetType: options.assetType, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url, method: "GET", headers });
    console.log("\nDirect OKX response summary:");
    console.log(JSON.stringify(summarizeDirectResponse(plainResponse), null, 2));
  }

  const { summary } = await startAttestedRequest({
    request: buildAttestationRequest({ url, headers }),
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "okx-wallet-total-value-demo",
      address: options.address.toLowerCase(),
      chains: options.chains,
      assetType: options.assetType,
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
