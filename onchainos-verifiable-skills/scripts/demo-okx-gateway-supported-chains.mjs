import process from "node:process";

import {
  DEFAULT_TIMEOUT_MS,
  ZERO_ADDRESS,
  createOkxHeaders,
  fetchJson,
  parseTimeoutMs,
  startAttestedRequest,
} from "./lib/demo-utils.mjs";

const REQUEST_PATH = "/api/v6/dex/pre-transaction/supported/chain";

function parseArgs(argv) {
  const options = {
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
  console.log(`Minimal OKX gateway-supported-chains + Primus zkTLS demo

Usage:
  npm run demo:gateway-supported-chains -- [options]

Options:
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
    { keyName: "name", parseType: "json", parsePath: "$.data[0].name" },
    { keyName: "shortName", parseType: "json", parsePath: "$.data[0].shortName" },
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
    name: firstRow.name,
    shortName: firstRow.shortName,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const url = `https://web3.okx.com${REQUEST_PATH}`;
  const headers = createOkxHeaders({
    method: "GET",
    requestPathWithQuery: REQUEST_PATH,
    bodyString: "",
  });

  console.log("Running gateway-supported-chains zkTLS demo...");
  console.log(JSON.stringify({ timeoutMs: options.timeoutMs }, null, 2));

  if (!options.skipDirectFetch) {
    const plainResponse = await fetchJson({ url, method: "GET", headers });
    console.log("\nDirect OKX response summary:");
    console.log(JSON.stringify(summarizeDirectResponse(plainResponse), null, 2));
  }

  const { summary } = await startAttestedRequest({
    request: buildAttestationRequest({ url, headers }),
    responseResolves: buildResponseResolves(),
    additionParams: {
      scene: "okx-gateway-supported-chains-demo",
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
