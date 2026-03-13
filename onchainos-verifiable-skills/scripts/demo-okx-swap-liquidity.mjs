import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createOkxHeaders,
  fetchJson,
  parseTimeoutMs,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const REQUEST_PATH = "/api/v6/dex/aggregator/get-liquidity";
const DEFAULT_CHAIN_INDEX = "1";

function parseArgs(argv) {
  const options = {
    chainIndex: process.env.DEMO_LIQUIDITY_CHAIN_INDEX || DEFAULT_CHAIN_INDEX,
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
  console.log(`Minimal OKX swap-liquidity + Primus zkTLS demo

Usage:
  npm run demo:swap-liquidity -- [options]

Options:
  --chain-index <id>       OKX chain index (default: ${DEFAULT_CHAIN_INDEX})
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

function buildRequestPathWithQuery(chainIndex) {
  return `${REQUEST_PATH}?${new URLSearchParams({ chainIndex }).toString()}`;
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
    { keyName: "id", parseType: "json", parsePath: "$.data[0].id" },
    { keyName: "name", parseType: "json", parsePath: "$.data[0].name" },
    { keyName: "logo", parseType: "json", parsePath: "$.data[0].logo" },
  ];
}

function summarizeDirectResponse(responseJson) {
  const firstRow = responseJson?.data?.[0];
  if (!firstRow) {
    return responseJson;
  }

  return {
    code: responseJson.code,
    id: firstRow.id,
    name: firstRow.name,
    logo: firstRow.logo,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const requestPathWithQuery = buildRequestPathWithQuery(options.chainIndex);
  const url = `https://web3.okx.com${requestPathWithQuery}`;
  const headers = createOkxHeaders({
    method: "GET",
    requestPathWithQuery,
    bodyString: "",
  });

  console.log("Running swap-liquidity zkTLS demo...");
  console.log(JSON.stringify({ chainIndex: options.chainIndex, timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url, method: "GET", headers });
    console.log("\nDirect OKX response summary:");
    console.log(JSON.stringify(summarizeDirectResponse(plainResponse), null, 2));
  }

  const { summary } = await startAttestedRequest({
    request: buildAttestationRequest({ url, headers }),
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "okx-swap-liquidity-demo",
      chainIndex: options.chainIndex,
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
