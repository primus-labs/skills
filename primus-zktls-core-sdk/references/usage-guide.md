# Primus zkTLS Core SDK Usage Guide

This guide is based on:

- `primus-labs/zktls-core-sdk`
- `primus-labs/zktls-contracts`

It documents the practical integration flow from SDK calls to Solidity verification.

## 1. Install

```bash
npm install @primuslabs/zktls-core-sdk
```

The upstream repository itself uses:

```bash
npm install
npm run test
```

## 2. Main Entry

The main SDK class is `PrimusCoreTLS`.

```ts
import { PrimusCoreTLS, Attestation } from "@primuslabs/zktls-core-sdk";
```

The class exposes these main methods:

- `init(appId: string, appSecret: string, mode?: "auto" | "native" | "wasm")`
- `generateRequestParams(request, responseResolves, userAddress?)`
- `startAttestation(attRequest, timeout?)`
- `verifyAttestation(attestation)`
- `sign(signParams)`

## 3. Exported Types

### `AttNetworkRequest`

Describes one upstream HTTP request to be attested.

```ts
type AttNetworkRequest = {
  url: string;
  method: string;
  header?: object;
  body?: any;
};
```

Notes:

- `url` must be a valid absolute URL.
- `method` must be one of the standard HTTP methods validated by the SDK.
- `header` is optional.
- `body` is optional.

### `AttNetworkResponseResolve`

Describes which response field should be revealed or constrained.

```ts
type AttNetworkResponseResolve = {
  keyName: string;
  parsePath: string;
  parseType?: string;
  op?: string;
};
```

Notes:

- `keyName` is the exposed field name in the proof output.
- `parsePath` is usually a JSONPath, for example `$.data[0].instType`.
- `parseType` is present in examples as `"json"`.
- `op` affects how the field is interpreted in attestation assembly:
  - empty or omitted: reveal the field
  - comparison operators such as `>`, `>=`, `=`, `!=`, `<`, `<=`, `STREQ`, `STRNEQ`: range/value checks
  - `SHA256_EX`: special reveal transform handled in `assembly_params.ts`

### `Attestation`

The proof object used for both local and on-chain verification.

```ts
type Attestation = {
  recipient: string;
  request: AttNetworkRequest;
  reponseResolve: AttNetworkResponseResolve[];
  data: string;
  attConditions: string;
  timestamp: number;
  additionParams: string;
  attestors: { attestorAddr: string; url: string }[];
  signatures: string[];
};
```

## 4. Initialization

Use `init()` before anything else.

```ts
const zkTLS = new PrimusCoreTLS();
await zkTLS.init(appId, appSecret, "auto");
```

Parameters:

- `appId`: Primus application id
- `appSecret`: used by the SDK as an EVM private key to sign the request payload
- `mode`:
  - `"auto"`: try native first, then fall back to wasm
  - `"native"`: require native addon
  - `"wasm"`: use wasm backend

Behavior:

- `init()` stores `appId` and `appSecret` in the instance
- initializes the algorithm module
- sets internal log level to `error`

## 5. Minimal zkTLS Flow

### Step 1: Build the request

```ts
const request = {
  url: "https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=bitcoin",
  method: "GET",
  header: {
    "user-agent": "Mozilla/5.0"
  },
  body: ""
};
```

### Step 2: Build response resolve rules

```ts
const responseResolves = [
  {
    keyName: "bitcoinusd",
    parseType: "json",
    parsePath: "$.bitcoin.usd"
  }
];
```

### Step 3: Generate request params

```ts
const attRequest = zkTLS.generateRequestParams(request, responseResolves);
```

What `generateRequestParams()` does:

- validates request structure
- injects `appId`
- fills default `userAddress` with `0x0000000000000000000000000000000000000000` if omitted
- returns an `AttRequest` instance

### Step 4: Optional request customization

```ts
attRequest.setAttMode({
  algorithmType: "proxytls",
  resultType: "plain"
});

attRequest.setNoProxy(false);
attRequest.setRequestInterval(1000);
attRequest.setAdditionParams(JSON.stringify({ scene: "price-proof" }));
```

Available `AttRequest` mutators:

- `setAdditionParams(string)`
- `setAttMode({ algorithmType, resultType })`
- `setAttConditions(object)`
- `setSslCipher("ECDHE-RSA-AES128-GCM-SHA256" | "ECDHE-ECDSA-AES128-GCM-SHA256")`
- `setNoProxy(boolean)`
- `setRequestInterval(number)`

Default values in the SDK:

- `attMode.algorithmType = "proxytls"`
- `attMode.resultType = "plain"`
- `sslCipher = "ECDHE-RSA-AES128-GCM-SHA256"`
- `noProxy = true`
- `requestInterval = -1`

### Step 5: Start attestation

```ts
const attestation = await zkTLS.startAttestation(attRequest, 2 * 60 * 1000);
```

What `startAttestation()` does internally:

1. validates the full attestation input
2. checks application quota by calling `getAppQuote({ appId })`
3. serializes the request
4. signs the serialized request with `appSecret`
5. assembles algorithm-side attestation parameters
6. calls `getAttestation(...)`
7. polls with `getAttestationResult(timeout)`
8. returns `JSON.parse(encodedData)` from the successful result

## 6. Full Working Example

```ts
import { PrimusCoreTLS } from "@primuslabs/zktls-core-sdk";

async function main() {
  const appId = process.env.ZKTLS_APP_ID!;
  const appSecret = process.env.ZKTLS_APP_SECRET!;

  const zkTLS = new PrimusCoreTLS();
  await zkTLS.init(appId, appSecret, "auto");

  const request = {
    url: "https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=bitcoin",
    method: "GET",
    header: {
      "user-agent": "Mozilla/5.0"
    },
    body: ""
  };

  const responseResolves = [
    {
      keyName: "bitcoinusd",
      parseType: "json",
      parsePath: "$.bitcoin.usd"
    }
  ];

  const attRequest = zkTLS.generateRequestParams(
    request,
    responseResolves,
    "0x0000000000000000000000000000000000000000"
  );

  attRequest.setAttMode({
    algorithmType: "proxytls",
    resultType: "plain"
  });

  const attestation = await zkTLS.startAttestation(attRequest);

  const ok = zkTLS.verifyAttestation(attestation);
  console.log("local verify:", ok);
  console.log("attestation:", JSON.stringify(attestation, null, 2));
}

main().catch(console.error);
```

## 7. Batch Requests

The SDK supports multiple requests in one attestation flow.

Input shape:

- `request: AttNetworkRequest[]`
- `responseResolves: AttNetworkResponseResolve[][]`

Example:

```ts
const requests = [
  {
    url: "https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=BTC-USD",
    method: "GET",
    header: {},
    body: ""
  },
  {
    url: "https://www.okx.com/api/v5/public/time",
    method: "GET",
    header: {},
    body: ""
  }
];

const responseResolves = [
  [
    {
      keyName: "instType",
      parseType: "json",
      parsePath: "$.data[0].instType"
    }
  ],
  [
    {
      keyName: "time",
      parseType: "json",
      parsePath: "$.data[0].ts"
    }
  ]
];

const attRequest = zkTLS.generateRequestParams(requests, responseResolves);
```

How it is assembled:

- each request becomes one entry in `requests`
- each inner resolve array becomes one response condition group
- `attConditions[idx]` is matched against the same response group index

### Default recommendation

For demos and first integrations, keep the default `proxytls` path.

- It is already the SDK default.
- It keeps the quick-start path aligned with the current `AttRequest` defaults.
- Only switch to `mpctls` when the user explicitly asks for it or has a verified requirement for that mode.

## 8. Attestation Conditions

`setAttConditions()` is used when the proof should enforce comparisons instead of only revealing values.

The internal shape consumed by `assembly_params.ts` is effectively:

```ts
type AttConditionItem = {
  field: string;
  op: string;
  value: string;
};
```

Example:

```ts
attRequest.setAttConditions([
  [
    {
      field: "bitcoinusd",
      op: ">=",
      value: "100000"
    }
  ]
]);
```

Interpretation:

- `field` should match `keyName`
- `op` drives the emitted condition type
- `value` is the comparison target

Important mapping performed by the SDK:

- comparison operators become `FIELD_RANGE`
- omitted operator becomes `FIELD_REVEAL`
- `SHA256_EX` becomes a reveal transform around a SHA256 arithmetic field

## 9. How Signing Works

The SDK signs the JSON string returned by `attRequest.toJsonString()`.

Implementation detail:

1. compute `keccak256(new TextEncoder().encode(signParams))`
2. sign that hash with `new ethers.Wallet(appSecret).signMessage(messageHash)`

This means:

- `appSecret` must be a valid private key understood by `ethers.Wallet`
- the signature is attached as `appSignature`
- downstream algorithm parameters include both `appSignParameters` and `appSignature`

## 10. Local Verification

Use:

```ts
const ok = zkTLS.verifyAttestation(attestation);
```

What it checks:

- encodes the attestation
- recovers the signer from `attestation.signatures[0]`
- compares it against the SDK constant:

```ts
PADOADDRESS = 0xDB736B13E2f522dBE18B2015d0291E4b193D8eF6
```

Important limitation:

- this is a boolean signer check against the built-in constant
- it is not the same thing as verifying against the attestor set of a specific deployed contract

## 11. On-Chain Verification

Install contract package:

```bash
npm install @primuslabs/zktls-contracts
```

Consumer contract example:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {
    IPrimusZKTLS,
    Attestation
} from "@primuslabs/zktls-contracts/src/IPrimusZKTLS.sol";

contract ExampleVerifier {
    address public immutable primus;

    constructor(address primus_) {
        primus = primus_;
    }

    function verify(Attestation calldata attestation) external view returns (bool) {
        IPrimusZKTLS(primus).verifyAttestation(attestation);
        return true;
    }
}
```

Contract behavior:

- `verifyAttestation` is `view`
- it reverts if verification fails
- it returns normally if verification succeeds

### Primus deployed EVM contract addresses

Primus publishes deployed contract addresses for multiple EVM chains. Current addresses from the Primus on-chain interaction overview are:

| Network | Contract address |
| --- | --- |
| Linea | `0xe6a7E3d26B898e96fA8bC00fFE6e51b25Dc24d6a` |
| BNB Chain | `0xF24199D5D431bE869af3Da61162CbBb58C389324` |
| Arbitrum | `0x982Cef8d9F184566C2BeC48c4fb9b6e7B0b4A58B` |
| Scroll | `0x06c3c00dc556d2493A661E6a929d3E17f5F097a4` |
| opBNB | `0xadd538D8C857072eFC29C4c05F574c68f94137eF` |
| Taiko | `0x3760aB354507a29a9F5c65A66C74353fd86393FA` |
| Camp | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |
| Base | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |
| OKX | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |
| Sepolia | `0x3760aB354507a29a9F5c65A66C74353fd86393FA` |
| Holesky | `0xB3d8DDDc793F75a930313785e5d1612747093f25` |
| BNB Chain Testnet | `0xBc074EbE6D39A97Fb35726832300a950e2D94324` |
| opBNB Testnet | `0x3760aB354507a29a9F5c65A66C74353fd86393FA` |
| Taiko Hekla Testnet | `0x3760aB354507a29a9F5c65A66C74353fd86393FA` |
| Scroll Sepolia Testnet | `0x5267380F548EEcA48E57Cd468a66F846e1dEfD6e` |
| Base Sepolia Testnet | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |
| OKX Testnet | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |
| Monad Testnet | `0x1Ad7fD53206fDc3979C672C0466A1c48AF47B431` |
| Pharos Testnet | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |
| Sophon Testnet | `0x7068da2522c3Ba1f24594ce20E7d7A8EF574E89f` |
| Unichain Sepolia Testnet | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |

When writing integration guidance, prefer referencing the deployed Primus contract for the user's target chain instead of assuming they must deploy their own verifier first.

### Example: choose the Primus contract by chain

```ts
const primusAddressByChain: Record<string, string> = {
  "base": "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE",
  "base-sepolia": "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE",
  "arbitrum": "0x982Cef8d9F184566C2BeC48c4fb9b6e7B0b4A58B",
  "scroll": "0x06c3c00dc556d2493A661E6a929d3E17f5F097a4",
  "scroll-sepolia": "0x5267380F548EEcA48E57Cd468a66F846e1dEfD6e",
  "okx": "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE",
  "okx-testnet": "0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE"
};

const chainKey = isTestnet ? "base-sepolia" : "base";
const primusAddress = primusAddressByChain[chainKey];
```

Then pass `primusAddress` into your verifier contract constructor, or use it directly when calling `IPrimusZKTLS(primusAddress).verifyAttestation(attestation)`.

### What `PrimusZKTLS.verifyAttestation()` checks

From the contract implementation:

1. `attestation.signatures.length == 1`
2. signature byte length is `65`
3. `v` is `27` or `28`
4. recover signer from `encodeAttestation(attestation)`
5. recovered address must exist in `_attestors`

That means on-chain verification depends on contract configuration, not only the raw proof.

## 12. Managing Attestors

If you control a `PrimusZKTLS` deployment, the contract owner can manage accepted attestors.

Available functions on `PrimusZKTLS`:

- `initialize(address owner)`
- `setAttestor(Attestor calldata attestor)`
- `removeAttestor(address attestorAddr)`

Example owner-side setup:

```solidity
Attestor memory attestor = Attestor({
    attestorAddr: 0xDB736B13E2f522dBE18B2015d0291E4b193D8eF6,
    url: "https://primuslabs.xyz/"
});

primusZkTLS.setAttestor(attestor);
```

Operational note:

- the default initializer path adds the owner as an attestor
- the sample script in `zktls-contracts` also shows adding the Primus address as an attestor
- if your proof is signed by a signer not configured in `_attestors`, on-chain verification reverts with `Invalid signature`

## 13. Attestation Struct Expected By Solidity

The Solidity interface expects:

```solidity
struct Attestation {
    address recipient;
    AttNetworkRequest request;
    AttNetworkResponseResolve[] reponseResolve;
    string data;
    string attConditions;
    uint64 timestamp;
    string additionParams;
    Attestor[] attestors;
    bytes[] signatures;
}
```

Nested structs:

```solidity
struct AttNetworkRequest {
    string url;
    string header;
    string method;
    string body;
}

struct AttNetworkResponseResolve {
    string keyName;
    string parseType;
    string parsePath;
}

struct Attestor {
    address attestorAddr;
    string url;
}
```

When moving data from TypeScript to Solidity, pay special attention to:

- `header` is a JSON string in Solidity, but an object in SDK request input
- `body` is a string in Solidity, but can be object/string/array in SDK input
- the final attestation returned by the SDK must already be normalized into the Solidity-compatible shape

## 14. End-to-End Pattern

Recommended integration pattern:

1. Backend or trusted service calls the SDK with `appId` and `appSecret`.
2. Service generates an attestation for a specific upstream API response.
3. Service optionally verifies locally with `verifyAttestation()`.
4. The attestation is passed to a user-facing contract call.
5. Consumer contract calls `IPrimusZKTLS.verifyAttestation(attestation)`.
6. Business logic continues only after verification succeeds.

Example business gating:

- unlock feature if KYC level is proven
- accept loan terms if account balance proof passes
- allow mint if ownership or account state is proven

## 15. Common Failure Cases

### SDK parameter validation errors

Error code `00005` can come from:

- missing request
- empty request array
- invalid URL
- missing method
- invalid method
- invalid `userAddress`
- invalid `responseResolves`
- invalid timeout

### Quota or app credential issues

The SDK checks `/public/app/quote` and can throw:

- `-1002001`: invalid app id
- `-1002002`: invalid app secret
- `-1002003`: trial quota exhausted
- `-1002004`: subscription expired
- `-1002005`: quota exhausted

### Runtime flow issues

- `00001`: algorithm startup exception
- `00002`: verification process timed out
- `00003`: another verification is already in progress
- `00104`: attestation requirements not met

### On-chain failures

Common revert causes:

- signature array length is not `1`
- signature byte length is not `65`
- signer is not in `_attestors`

## 16. Practical Recommendations

- Start with a single `GET` request and a single JSONPath reveal field.
- Use `mpctls` only when you need it; otherwise keep defaults simple.
- Pass a real `userAddress` if the downstream app binds the proof to a wallet.
- Keep `keyName` stable because `attConditions` match against it.
- Treat local verification and on-chain verification as separate checks.
- For production chain usage, confirm the deployed contract's accepted attestors before relying on verification.
