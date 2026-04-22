import crypto from "node:crypto";

import { PrimusCoreTLS } from "@primuslabs/zktls-core-sdk";

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

export function parseTimeoutMs(value) {
  const timeoutMs = Number(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeout must be a positive number");
  }

  return timeoutMs;
}

export function createOkxHeaders({ method, requestPathWithQuery, bodyString = "", contentType }) {
  const timestamp = new Date().toISOString();
  const secretKey = readRequiredEnv("OKX_SECRET_KEY", ["OKX_API_SECRET"]);
  const headers = {
    Accept: "application/json",
    "OK-ACCESS-KEY": readRequiredEnv("OKX_API_KEY"),
    "OK-ACCESS-PASSPHRASE": readRequiredEnv("OKX_PASSPHRASE", ["OKX_API_PASSPHRASE"]),
    "OK-ACCESS-TIMESTAMP": timestamp,
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const prehash = `${timestamp}${method.toUpperCase()}${requestPathWithQuery}${bodyString}`;
  headers["OK-ACCESS-SIGN"] = crypto
    .createHmac("sha256", secretKey)
    .update(prehash)
    .digest("base64");

  return headers;
}

export async function fetchJson({ url, method, headers, body }) {
  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`OKX request failed with status ${response.status}: ${text}`);
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

export function summarizeAttestation(attestation, localVerification) {
  return {
    localVerification,
    recipient: attestation.recipient,
    request: attestation.request,
    attestors: attestation.attestors,
    signatures: attestation.signatures?.length || 0,
    timestamp: attestation.timestamp,
    attestedData: parseAttestedData(attestation.data),
  };
}

export async function startAttestedRequest({
  request,
  responseResolves,
  additionParams,
  timeoutMs,
  userAddress = ZERO_ADDRESS,
}) {
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
    summary: summarizeAttestation(attestation, localVerification),
  };
}
