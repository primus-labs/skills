import crypto from "node:crypto";
import process from "node:process";

export const DEFAULT_TIMEOUT_MS = 120_000;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function readRequiredEnv(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  const allNames = [name, ...aliases].join(", ");
  throw new Error(`Missing required environment variable. Accepted names: ${allNames}`);
}

export function readOptionalEnv(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function parseTimeoutMs(value) {
  const timeoutMs = Number(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeout must be a positive number");
  }

  return timeoutMs;
}

export function buildQueryString(params) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          searchParams.append(key, String(item));
        }
      }
      continue;
    }

    searchParams.append(key, String(value));
  }

  return searchParams.toString();
}

export function createPublicHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json",
    ...extraHeaders,
  };
}

export function buildPublicRequest({ baseUrl, path, params = {}, extraHeaders = {} }) {
  const queryString = buildQueryString(params);
  const url = `${baseUrl}${path}${queryString ? `?${queryString}` : ""}`;

  return {
    url,
    method: "GET",
    header: createPublicHeaders(extraHeaders),
    body: "",
  };
}

export function buildSignedQuery({ params = {}, recvWindow }) {
  const query = {
    ...params,
    timestamp: Date.now(),
  };

  if (recvWindow !== undefined) {
    query.recvWindow = recvWindow;
  }

  return query;
}

export function createSignedRequest({ baseUrl, path, params = {}, recvWindow }) {
  const apiKey = readRequiredEnv("BINANCE_API_KEY");
  const apiSecret = readRequiredEnv("BINANCE_API_SECRET");
  const signedQuery = buildSignedQuery({ params, recvWindow });
  const queryString = buildQueryString(signedQuery);
  const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");
  const url = `${baseUrl}${path}?${queryString}&signature=${signature}`;

  return {
    url,
    method: "GET",
    header: createPublicHeaders({
      "X-MBX-APIKEY": apiKey,
    }),
    body: "",
  };
}

export async function fetchJson({ url, method, headers, body }) {
  const requestInit = {
    method,
    headers,
  };

  if (body && method !== "GET" && method !== "HEAD") {
    requestInit.body = body;
  }

  const response = await fetch(url, requestInit);

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Binance request failed with status ${response.status}: ${text}`);
  }

  return data;
}

export function parseAttestedData(dataPreview) {
  if (!dataPreview) {
    return null;
  }

  try {
    const parsed = JSON.parse(dataPreview);
    const normalized = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        try {
          normalized[key] = JSON.parse(value);
        } catch {
          normalized[key] = value;
        }
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return dataPreview;
  }
}

export function deriveClaimFromScene(scene, fallbackUrl) {
  if (scene) {
    return String(scene)
      .replace(/^binance-/, "")
      .replace(/-demo$/, "")
      .replace(/-/g, " ");
  }

  if (fallbackUrl) {
    try {
      const url = new URL(fallbackUrl);
      return url.pathname.replace(/^\//, "").replace(/\//g, " ");
    } catch {
      return "binance proof";
    }
  }

  return "binance proof";
}

export function buildProofContract({
  attestation,
  localVerification,
  request,
  additionParams,
  proofType = "partial",
  verifiesWhat,
  doesNotVerify,
}) {
  const attestedData = parseAttestedData(attestation.data);
  const endpoint = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return request.url;
    }
  })();
  const claim = additionParams?.claim || deriveClaimFromScene(additionParams?.scene, request.url);

  return {
    claim,
    endpoint,
    proofType,
    proofStatus: localVerification ? "attested" : "fallback",
    localVerification,
    extractedFields: attestedData,
    verifiesWhat:
      verifiesWhat ||
      "The extracted fields came from the attested Binance HTTPS response for this endpoint.",
    doesNotVerify:
      doesNotVerify ||
      "It does not prove broader account state, historical continuity, or exchange-side execution beyond this response snapshot.",
  };
}

export function summarizeAttestation(attestation, localVerification, meta = {}) {
  const contract = buildProofContract({
    attestation,
    localVerification,
    request: meta.request || attestation.request,
    additionParams: meta.additionParams,
    proofType: meta.proofType,
    verifiesWhat: meta.verifiesWhat,
    doesNotVerify: meta.doesNotVerify,
  });

  return {
    ...contract,
    attestation: {
      recipient: attestation.recipient,
      request: attestation.request,
      attestors: attestation.attestors,
      signatures: attestation.signatures?.length || 0,
      timestamp: attestation.timestamp,
      attestedData: contract.extractedFields,
    },
  };
}

export async function startAttestedRequest({
  request,
  responseResolves,
  additionParams,
  timeoutMs,
  userAddress = ZERO_ADDRESS,
  proofType = "partial",
  verifiesWhat,
  doesNotVerify,
}) {
  const { PrimusCoreTLS } = await import("@primuslabs/zktls-core-sdk");
  const zkTLS = new PrimusCoreTLS();
  await zkTLS.init(
    readRequiredEnv("ZKTLS_APP_ID", ["PRIMUS_APP_ID"]),
    readRequiredEnv("ZKTLS_APP_SECRET", ["PRIMUS_APP_SECRET"]),
    "auto"
  );

  const attRequest = zkTLS.generateRequestParams(request, responseResolves, userAddress);
  attRequest.setAttMode({
    algorithmType: "proxytls",
    resultType: "plain",
  });
  attRequest.setAdditionParams(JSON.stringify(additionParams));

  const attestation = await zkTLS.startAttestation(attRequest, timeoutMs);
  const localVerification = await Promise.resolve(zkTLS.verifyAttestation(attestation));

  return {
    attestation,
    localVerification,
    summary: summarizeAttestation(attestation, localVerification, {
      request,
      additionParams,
      proofType,
      verifiesWhat,
      doesNotVerify,
    }),
  };
}

export function buildTopRowSummary(responseJson, keys) {
  const firstRow = responseJson?.data?.[0] || responseJson?.data?.rows?.[0] || responseJson?.data?.list?.[0];
  if (!firstRow) {
    return responseJson;
  }

  const summary = {};
  for (const key of keys) {
    summary[key] = firstRow[key];
  }
  return summary;
}

export function printJson(title, data) {
  console.log(`\n${title}:`);
  console.log(JSON.stringify(data, null, 2));
}

export function normalizeSymbol(symbol) {
  return String(symbol).toUpperCase();
}
