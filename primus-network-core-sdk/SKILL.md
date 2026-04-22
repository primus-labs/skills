# primus-network-core-sdk

Build a **backend / server-side** Node.js program that uses `@primuslabs/network-core-sdk` to generate zkTLS attestations directly — without requiring the Primus browser extension or any user interaction.

## Trigger Prompt

```
Use the primus-network-core-sdk skill to build a program that proves <what_to_prove>.
The requests are <url_list>. My wallet private key is <privatekey>. Chain: <chain>.
```

## Repositories & Docs

- Install guide: https://docs.primuslabs.xyz/build/for-backend/install
- Simple example: https://docs.primuslabs.xyz/build/for-backend/simpleexample
- zkTLS Operations (op / privacy): https://docs.primuslabs.xyz/build/op
- Multiple URLs: https://docs.primuslabs.xyz/build/multi-url
- Mutual TLS (mTLS): https://docs.primuslabs.xyz/build/mtls
- DVC pattern: https://docs.primuslabs.xyz/build/dvc
- Attestation structure: https://docs.primuslabs.xyz/build/misc/attestation-structure
- Error codes: https://docs.primuslabs.xyz/build/misc/error-code
- Demo repo: https://github.com/primus-labs/zktls-demo
  - Backend example: `zktls-demo/network-core-sdk-example`
  - mTLS example: `zktls-demo/network-core-sdk-mtls-example`

## SDK Positioning — Which SDK to Use

| | `network-core-sdk` (this skill) | `network-js-sdk` | `zktls-js-sdk` |
|---|---|---|---|
| Runs in | Node.js backend / AI agent | Browser (frontend) | Browser (frontend) |
| Primus extension required | **No** | Yes | Yes |
| User interaction required | **No** | Yes (user logs in via popup) | Yes (user logs in via popup) |
| Auth | Wallet private key | Wallet (MetaMask) | appId + appSecret |
| On-chain tx | Yes (`submitTask` costs gas) | Yes | No |
| Requests configured by | Developer (hardcoded or dynamic) | Template ID | Template ID |
| Best for | AI agents, automated proofs, PoR | User-facing DApps (browser) | Enterprise DApps (browser) |

**Use `network-core-sdk` when:**
- The attestation should run automatically without user interaction
- You are building an AI agent, a scheduled job, or a Proof-of-Reserve system
- You control the credentials (API keys, cookies) needed to access the target data source
- You do not want to require users to install the Primus extension

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | Verify with `node -v` |
| Wallet private key | Used to sign `submitTask` gas transaction on-chain. Store in `.env`, never hardcode. |
| Wallet address | The `address` field in `submitTask`. Derived from the private key. |
| ETH on target chain | Gas for `submitTask`. Default: Base Sepolia testnet. Faucet: https://www.alchemy.com/faucets/base-sepolia |
| Target URL(s) + credential | The HTTP endpoint(s) to attest and any auth headers/cookies needed |

## Output

Always scaffold a complete Node.js project:

```
<project-name>/
├── src/
│   └── index.js      ← main attestation script (CommonJS)
├── .env.example      ← template for secrets
├── package.json
└── README.md
```

### .env.example (safe to commit — placeholder values only)

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
ADDRESS=0xYOUR_WALLET_ADDRESS_HERE
```

### .gitignore (always generate this file)

```
.env
.env.*
!.env.example
node_modules/
```

> ⚠️ Always generate `.gitignore` with `.env` excluded **before writing any other file**. If the user runs `git init` and commits before `.gitignore` is in place, the private key will be in git history permanently.

```json
{
  "name": "<project-name>",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "@primuslabs/network-core-sdk": "latest",
    "ethers": "^5.7.0",
    "dotenv": "^16.0.0"
  }
}
```

> **Important:** Use **ethers v5**, not v6. The SDK example uses `ethers.providers.JsonRpcProvider` and `ethers.Wallet` which are ethers v5 APIs. ethers v6 renamed these to `ethers.JsonRpcProvider` and changed the import pattern.

## Core Workflow

```
1. Load wallet (ethers.Wallet from private key + JsonRpcProvider)
   ↓
2. primusNetwork.init(wallet, chainId)
   ↓
3. primusNetwork.submitTask({ address })        ← on-chain tx, costs gas
   ↓
4. Build requests[] and responseResolves[]
   ↓
5. primusNetwork.attest({ ...submitTaskParams, ...submitTaskResult, requests, responseResolves, [options] })
   ↓
6. attestResult[0]  ← the attestation object
   ↓
7. (optional) primusNetwork.verifyAndPollTaskResult({ taskId, reportTxHash })
   ↓
8. (optional) primusNetwork.getAllJsonResponse(taskId)   ← for DVC / zkVM use
```

## Complete Minimal Example

```js
require('dotenv').config();
const { PrimusNetwork } = require('@primuslabs/network-core-sdk');
const { ethers } = require('ethers');

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ADDRESS     = process.env.ADDRESS;       // derived from private key
const CHAIN_ID    = 84532;                     // Base Sepolia
const RPC_URL     = 'https://sepolia.base.org';

// Define what to attest
const requests = [
  {
    url: 'https://api.example.com/data',
    method: 'GET',
    header: { Authorization: 'Bearer YOUR_TOKEN' },
    body: '',
  },
];

const responseResolves = [
  [
    {
      keyName: 'fieldName',       // label used in attestation.data output
      parseType: 'json',          // always 'json' for JSON responses
      parsePath: '$.path.to.field', // JSONPath expression
      // op: 'SHA256',            // optional — see Privacy Options below
    },
  ],
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

  const primusNetwork = new PrimusNetwork();
  await primusNetwork.init(wallet, CHAIN_ID);
  console.log('SDK initialized');

  const submitTaskParams = { address: ADDRESS };
  const submitTaskResult = await primusNetwork.submitTask(submitTaskParams);
  console.log('Task submitted:', submitTaskResult.taskId);

  const attestParams = {
    ...submitTaskParams,
    ...submitTaskResult,
    requests,
    responseResolves,
    // attMode: { algorithmType: 'proxytls' }, // optional, default proxytls
    // getAllJsonResponse: 'true',              // optional, for DVC
  };

  const attestResult = await primusNetwork.attest(attestParams);
  console.log('Attestation:', JSON.stringify(attestResult[0], null, 2));

  // Optional: wait for on-chain confirmation
  const taskResult = await primusNetwork.verifyAndPollTaskResult({
    taskId:        attestResult[0].taskId,
    reportTxHash:  attestResult[0].reportTxHash,
  });
  console.log('On-chain result:', taskResult);
}

main().catch(console.error);
```

## `requests` Array — Field Reference

Each element in `requests` corresponds to one HTTP call. The array is ordered — index 0 maps to `responseResolves[0]`.

```js
{
  url:    'https://...',    // required — full URL including query string
  method: 'GET',            // required — 'GET' | 'POST' | 'PUT' etc.
  header: {                 // required (can be empty {})
    'Authorization': 'Bearer token',
    'Cookie': 'session=abc123',
    'Content-Type': 'application/json',
  },
  body: '',                 // required (empty string for GET, JSON string for POST)
}
```

## `responseResolves` Array — Field Reference

Outer array = one element per URL (matches `requests` by index).
Inner array = one element per field to extract from that URL's response.

```js
responseResolves = [
  // URL 0 fields:
  [
    {
      keyName:   'myField',         // required — label in attestation.data output
      parseType: 'json',            // required — always 'json'
      parsePath: '$.data[0].value', // required — JSONPath to the field
      op:        'REVEAL_STRING',   // optional — default, returns plaintext
      // op: 'SHA256',              // hash this field — see Privacy Options
      // op: 'SHA256_EX',           // hash across multiple URLs
      // op: '>',  value: '100',    // conditional — returns true/false
    },
  ],
  // URL 1 fields (if multiple URLs):
  [
    {
      keyName:   'otherField',
      parseType: 'json',
      parsePath: '$.result',
    },
  ],
];
```

## Privacy Options (`op` field)

| `op` value | Returns | Use case |
|---|---|---|
| `REVEAL_STRING` (default) | Plaintext value | No privacy needed |
| `SHA256` | SHA256 hex hash | Hide a single field's value |
| `SHA256_EX` | SHA256 hex hash | Hide multiple fields across multiple URLs |
| `>` + `value` | `"true"` or `"false"` | Prove a threshold without revealing the number |
| `<` + `value` | `"true"` or `"false"` | Same — less than |
| `=` + `value` | `"true"` or `"false"` | Prove equality |
| `!=` + `value` | `"true"` or `"false"` | Prove inequality |
| `>=` + `value` | `"true"` or `"false"` | Greater than or equal |
| `<=` + `value` | `"true"` or `"false"` | Less than or equal |

```js
// Examples:
{ keyName: 'balance', parseType: 'json', parsePath: '$.balance', op: 'SHA256' }
{ keyName: 'userId',  parseType: 'json', parsePath: '$.uid',     op: 'SHA256_EX' }
{ keyName: 'volume',  parseType: 'json', parsePath: '$.vol',     op: '>', value: '10000' }
```

## Multiple URLs

When proving data from more than one API endpoint in a single attestation:

```js
const requests = [
  { url: 'https://api.exchange.com/price/BTC', method: 'GET', header: {}, body: '' },
  { url: 'https://api.exchange.com/price/ETH', method: 'GET', header: {}, body: '' },
];

const responseResolves = [
  // Fields from requests[0]
  [
    { keyName: 'btcPrice', parseType: 'json', parsePath: '$.data[0].price' },
    { keyName: 'btcVol',   parseType: 'json', parsePath: '$.data[0].volume', op: '>', value: '1000' },
  ],
  // Fields from requests[1]
  [
    { keyName: 'ethPrice', parseType: 'json', parsePath: '$.data[0].price' },
  ],
];
```

**Critical rule:** `requests[i]` maps to `responseResolves[i]` by index. The arrays must have the same length. Mismatched lengths or wrong ordering will cause silent wrong results or errors.

## attest() Options Reference

```js
const attestParams = {
  // Required — spread both:
  ...submitTaskParams,   // { address }
  ...submitTaskResult,   // { taskId, taskTxHash, taskAttestors }
  requests,
  responseResolves,

  // Optional:
  attMode: {
    algorithmType: 'proxytls', // 'proxytls' (default) | 'mpctls'
    // proxytls: routes through Primus proxy nodes — faster, but some APIs block proxy IPs
    // mpctls:   multi-party TLS — slower, but harder to detect; use for APIs that block proxytls
  },

  getAllJsonResponse: 'true', // default 'false'
  // Set to 'true' to enable getAllJsonResponse(taskId) after attest()
  // Required for DVC / zkVM workflow — raw HTTP response is stored and retrievable

  mTLS: {
    clientKey: fs.readFileSync('./client.key').toString(),
    clientCrt: fs.readFileSync('./client.crt').toString(),
  },
  // Only needed when the target server requires mutual TLS client certificate auth
};
```

## verifyAndPollTaskResult

Optional — only needed when you require confirmed on-chain settlement of the attestation.

```js
const taskResult = await primusNetwork.verifyAndPollTaskResult({
  taskId:       attestResult[0].taskId,
  reportTxHash: attestResult[0].reportTxHash, // optional
  intervalMs:   2000,   // optional, default 2000ms
  timeoutMs:    60000,  // optional, default 60s
});
```

## getAllJsonResponse — DVC Workflow

When `getAllJsonResponse: 'true'` is set in `attestParams`, you can retrieve the raw HTTP response bodies after attestation. Used together with a zkVM for the DVC pattern.

```js
// Must set in attestParams first:
const attestParams = { ..., getAllJsonResponse: 'true' };
const attestResult = await primusNetwork.attest(attestParams);

// Then retrieve raw responses:
const allJsonResponse = await primusNetwork.getAllJsonResponse(attestResult[0].taskId);
// allJsonResponse[0].content = raw JSON string from requests[0]
// allJsonResponse[1].content = raw JSON string from requests[1]
```

## Mutual TLS (mTLS)

When the target server requires client certificate authentication:

```js
const fs = require('fs');

const attestParams = {
  ...submitTaskParams,
  ...submitTaskResult,
  requests,
  responseResolves,
  mTLS: {
    clientKey: fs.readFileSync('./certs/client.key').toString(),
    clientCrt: fs.readFileSync('./certs/client.crt').toString(),
  },
};
```

Both `clientKey` and `clientCrt` must be PEM-format strings (not file paths).

## Chains Reference

| Chain | ID | RPC URL |
|---|---|---|
| Base Sepolia (testnet) | `84532` | `https://sepolia.base.org` |
| Base mainnet | `8453` | `https://mainnet.base.org` |

ETH faucet for Base Sepolia: https://www.alchemy.com/faucets/base-sepolia

## Working Rules

- **CRITICAL — Never expose your wallet private key or `.env` file publicly.** This is the single most dangerous mistake in backend development. Specifically:
  - Always add `.env` to `.gitignore` **before** the first `git commit`. Once committed and pushed, even if deleted later, the key is permanently compromised in git history.
  - Never paste private keys into chat, issues, PRs, logs, or any public forum.
  - Never commit `.env`, `.env.local`, `.env.production`, or any file containing `PRIVATE_KEY` to version control.
  - In CI/CD (GitHub Actions, Vercel, etc.), use the platform's secret manager — never put keys in `yaml` config files.
  - If a key is accidentally exposed anywhere public, **immediately transfer all funds out and rotate the key**. Treat it as fully compromised.
  - The `.env.example` file included in the scaffold is safe to commit — it contains only placeholder values, never real keys.

- **Never hardcode private key in source code.** Always use `process.env` + `.env` file, and add `.env` to `.gitignore`.
- **Use ethers v5, not v6.** The SDK uses `ethers.providers.JsonRpcProvider` and `new ethers.Wallet(key, provider)` — ethers v5 APIs. If you use v6, these will be undefined and throw.
- **`requests` and `responseResolves` must have the same array length.** Index 0 of `requests` maps to index 0 of `responseResolves`. A mismatch causes wrong results or errors.
- **`responseResolves` inner array = fields from the same URL.** Fields from different URLs go in different inner arrays. Putting all fields in a single inner array when they come from multiple URLs is wrong.
- **`op` defaults to `REVEAL_STRING`.** If you want privacy, explicitly set `op: 'SHA256'` or a comparison op. Forgetting this will expose raw values.
- **For multiple fields from the same URL needing different ops**, put them all in the same inner array, each with their own `op`:
  ```js
  [
    { keyName: 'id',  parsePath: '$.uid',   op: 'SHA256' },
    { keyName: 'vol', parsePath: '$.vol',   op: '>', value: '1000' },
  ]
  ```
- **`getAllJsonResponse: 'true'` must be set as a string, not boolean.** `'true'` not `true`.
- **`submitTask` requires gas.** Ensure the wallet has ETH on the target chain before running. A common failure mode is `submitTask` timing out silently due to insufficient gas.
- **`attMode.algorithmType` is nested inside an object.** It is `attMode: { algorithmType: 'mpctls' }`, not `attMode: 'mpctls'` (that is the network-js-sdk API, different from core-sdk).
- **`attestResult` is always an array.** Access the first attestation as `attestResult[0]`, not `attestResult.taskId`.
- **Parse `attestation.data` before use.** It is a stringified JSON string. Always `JSON.parse(attestResult[0].attestation.data)`.

## Attestation Result Structure

```js
attestResult[0] = {
  attestation: {
    recipient:       '0x...',     // address from submitTaskParams
    request:         [...],       // echo of requests array
    responseResolves: [...],      // echo of responseResolves array
    data:            '{"fieldName":"value",...}',  // ← stringified JSON, always parse
    attConditions:   '',
    timestamp:       1766377317483,
    additionParams:  '{"algorithmType":"proxytls"}',
  },
  attestor:       '0x...',
  signature:      '0x...',
  reportTxHash:   '0x...',
  taskId:         '0x...',
  attestationTime: 15094,       // ms
  attestorUrl:    '...',
}

// Parse data:
const data = JSON.parse(attestResult[0].attestation.data);
// data.fieldName → actual verified value (or hash, or "true"/"false")
```

## main.js / index.js Structure

Organize in this order:

```
1. require('dotenv').config()
2. const { PrimusNetwork } = require('@primuslabs/network-core-sdk')
3. const { ethers } = require('ethers')
4. Constants (CHAIN_ID, RPC_URL)
5. Load secrets from process.env (PRIVATE_KEY, ADDRESS)
6. Define requests[]
7. Define responseResolves[]
8. async function main() {
     a. Build provider + wallet (ethers v5)
     b. primusNetwork.init(wallet, chainId)
     c. submitTask({ address })
     d. attest({ ...submitTaskParams, ...submitTaskResult, requests, responseResolves, options })
     e. Parse and log attestResult[0].attestation.data
     f. (optional) verifyAndPollTaskResult
     g. (optional) getAllJsonResponse
   }
9. main().catch(console.error)
```

## Reference Files

- `references/attestation-structure.md` — full attestation object shape with annotated fields
- `references/error-codes.md` — all error codes with causes and fixes
- `references/chains.md` — chain IDs, RPC URLs, faucets
