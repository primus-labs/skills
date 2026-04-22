# Attestation Structure — network-core-sdk

## Full Shape

```js
attestResult[0] = {
  attestation: {
    recipient:        '0xUSER_ADDRESS',       // address from submitTaskParams
    request:          [ /* echo of requests array */ ],
    responseResolves: [ /* echo of responseResolves array */ ],
    data:             '{"field1":"value","field1.count":"1",...}', // ← stringified JSON
    attConditions:    '',                     // non-empty if conditions op was used
    timestamp:        1766377317483,          // unix ms of attestation execution
    additionParams:   '{"algorithmType":"proxytls"}',
  },
  attestor:        '0xATTESTOR_ADDRESS',
  signature:       '0xSIGNATURE_HEX',
  reportTxHash:    '0xREPORT_TX_HASH',       // on-chain report tx
  taskId:          '0xTASK_ID',
  attestationTime: 15094,                    // ms taken to complete
  attestorUrl:     'xxxx.dstack-base-prod7.phala.network',
}
```

## data Field

`attestation.data` is always a **stringified JSON string**. Always parse before use:

```js
const raw = attestResult[0].attestation.data;
const data = JSON.parse(raw);
```

### data output by op type

| `op` | Output in data |
|---|---|
| `REVEAL_STRING` (default) | `{ "fieldName": "actual value", "fieldName.count": "1" }` |
| `SHA256` | `{ "fieldName": "0xabc123..." }` (hex, no "0x" prefix in some versions) |
| `SHA256_EX` | Same as SHA256 — single combined hash for all tagged fields |
| `>` / `<` / `=` / `!=` / `>=` / `<=` | `{ "fieldName": "true" }` or `{ "fieldName": "false" }` |

Note: Plaintext fields include a `.count` suffix entry (e.g. `"fieldName.count": "1"`) indicating how many values matched the JSONPath. Hash and condition fields do not include the `.count` entry.

## Differences from network-js-sdk attestation

| | `network-core-sdk` | `network-js-sdk` |
|---|---|---|
| Data location | `attestResult[0].attestation.data` | `attestResult[0].data` |
| Has `signature` field | Yes (`attestResult[0].signature`) | Separate field |
| Has `attestorUrl` | Yes | No |
| Has `attestationTime` | Yes (ms) | No |
| Structure | Object with nested `attestation` | Flat object |

## Timestamp Validation

```js
const MAX_AGE_MS = 10 * 60 * 1000; // 10 min
const age = Date.now() - attestResult[0].attestation.timestamp;
if (age > MAX_AGE_MS) {
  throw new Error('Attestation is stale');
}
```

## Signature Verification

The `signature` field is an ECDSA signature by the attestor over the attestation contents. The `verifyAndPollTaskResult` function handles on-chain verification via Primus contracts. For off-chain signature verification, use the attestor's public key from `attestor` field.
