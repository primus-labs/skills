# Attestation Structure — zktls-js-sdk

When `startAttestation()` completes successfully, the returned object has this shape:

```json
{
  "recipient": "0xUSER_ADDRESS",
  "request": {
    "url": "REQUEST_URL",
    "header": "REQUEST_HEADER",
    "method": "GET|POST",
    "body": "REQUEST_BODY"
  },
  "reponseResolve": [
    {
      "keyName": "VERIFY_DATA_ITEM_NAME",
      "parseType": "",
      "parsePath": "$.json.path.to.field"
    }
  ],
  "data": "{\"fieldName\":\"actualValue\"}",
  "attConditions": "[{\"field\":\"fieldName\",\"op\":\">\",\"value\":\"100\"}]",
  "timestamp": 1710000000000,
  "additionParams": "{\"yourKey\":\"yourValue\"}",
  "attestors": [
    {
      "attestorAddr": "0xATTESTOR_ADDRESS",
      "url": "https://primuslabs.org"
    }
  ],
  "signatures": [
    "0xSIGNATURE_HEX"
  ]
}
```

## Key Fields

| Field | Type | Notes |
|---|---|---|
| `recipient` | string | User wallet address from `generateRequestParams` |
| `data` | string | **Stringified JSON** of verified fields. Always `JSON.parse()` before use. |
| `attConditions` | string | Stringified JSON of conditions used (if any) |
| `timestamp` | number | Unix ms timestamp of attestation execution |
| `additionParams` | string | Echoes back whatever you set with `setAdditionParams()` |
| `signatures` | string[] | Attestor's signatures — used by `verifyAttestation()` |
| `attestors` | object[] | Attestor address and URL |

## How to Parse `data`

```js
const attestation = await primusZKTLS.startAttestation(signedRequestStr);
const verifyResult = await primusZKTLS.verifyAttestation(attestation);

if (verifyResult === true) {
  let verifiedData = attestation.data;
  try {
    if (typeof verifiedData === 'string') {
      verifiedData = JSON.parse(verifiedData);
    }
  } catch (_) {}
  
  // verifiedData is now a plain object
  // e.g. { screen_name: "alice" }          ← plaintext mode
  // e.g. { screen_name: "0xabc123..." }    ← SHA256 mode
  // e.g. { totalAssets: "true" }           ← conditions mode
  console.log('Verified data:', verifiedData);
}
```

## Differences from network-js-sdk Attestation

| | `zktls-js-sdk` | `network-js-sdk` |
|---|---|---|
| Root type | Plain object | Array (take `[0]`) |
| `data` field | `attestation.data` | `attestResult[0].data` |
| Has `taskId` | No | Yes |
| Has `reportTxHash` | No | Yes |
| Has `signatures` | Yes (array) | Separate field |
| Verify | `verifyAttestation(attestation)` | Not built-in |

## Timestamp Validation (recommended)

```js
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const age = Date.now() - attestation.timestamp;
if (age > MAX_AGE_MS) {
  // Attestation is stale — reject
}
```
