# primus-zktls-js-sdk-dapp

Build a frontend DApp that uses `@primuslabs/zktls-js-sdk` (the **enterprise** zkTLS SDK) to prove off-chain data via Primus' proprietary attestor. Unlike the `network-js-sdk` (which uses Primus Network and requires a blockchain wallet + gas), this SDK authenticates via `appId`/`appSecret` obtained from the Primus Developer Hub, and does **not** require any on-chain transaction to run an attestation.

## Trigger Prompt

```
Use the primus-zktls-js-sdk-dapp skill to scaffold a DApp that proves <what_to_prove>.
The template ID is <template_id>. My appId is <app_id>. [My appSecret is <app_secret>.]
```

`appSecret` is optional in the prompt. If provided, scaffold in **test mode** (frontend signing, appSecret in code). If only `appId` is given, scaffold in **production mode** (backend signing) and remind the user to keep `appSecret` server-side only.

## Repositories & Docs

- SDK source: https://github.com/primus-labs/zktls-js-sdk
- Demo repo: https://github.com/primus-labs/zktls-demo
  - Test example: `zktls-demo/test-example`
  - Production example: `zktls-demo/production-example`
- Overview: https://docs.primuslabs.xyz/enterprise/zk-tls-sdk/overview
- Test guide: https://docs.primuslabs.xyz/enterprise/zk-tls-sdk/test
- Production guide: https://docs.primuslabs.xyz/enterprise/zk-tls-sdk/production
- Error codes: https://docs.primuslabs.xyz/enterprise/error-code
- Attestation structure: https://docs.primuslabs.xyz/enterprise/attestation-structure

## Two SDKs — Know Which One to Use

| | `@primuslabs/zktls-js-sdk` (this skill) | `@primuslabs/network-js-sdk` |
|---|---|---|
| Auth | `appId` + `appSecret` (from dev.primuslabs.xyz) | Wallet (MetaMask, etc.) |
| On-chain tx | Not required | Required (`submitTask` costs gas) |
| Blockchain | None needed | Base Sepolia / Base mainnet |
| Attestor | Primus' proprietary attestor | Primus Network decentralized nodes |
| Use case | Enterprise / rapid prototyping | Decentralized / on-chain proof |
| Free quota | 100 proofs per appId | No fixed quota |

**Use this SDK when**: you want to generate attestations via Primus' centralized proprietary attestor. The attestation itself can still be submitted to smart contracts for on-chain verification and used by other DApps — the difference is that the **attestation generation** step does not require a blockchain transaction or wallet signing.
**Use `network-js-sdk` when**: you need the attestation generation itself to be decentralized, with the attestation task registered and settled on-chain via Primus Network nodes.

## Prerequisites

Confirm the user has all of the following before writing any code. If anything is missing, point them to the relevant link first.

| Requirement | Notes |
|---|---|
| Node.js 18+ | Verify with `node -v` |
| `appId` + `appSecret` | Obtained from https://dev.primuslabs.xyz — create a Project there. Each appId gets 100 free proofs. |
| Template ID | UUID from https://dev.primuslabs.xyz — either create one or search existing templates. |
| Primus browser extension | Required for `startAttestation()` to execute the zkTLS protocol. Install from https://primuslabs.xyz. Without it, the attestation step will hang or fail silently. |
| User wallet address | Only needed as an identifier in `generateRequestParams`. No signing or gas required — any Ethereum-format address works, or users can input it manually. |

## Output

Always scaffold a complete Vite project. Write files to the working directory, zip, and return to the user.

```
<dapp-name>/
├── index.html
├── src/
│   ├── main.js          ← frontend only (test mode)
│   └── style.css
├── vite.config.js
├── package.json
└── README.md
```

For **production mode**, also scaffold a backend:
```
<dapp-name>/
├── frontend/
│   ├── index.html
│   ├── src/main.js
│   └── src/style.css
│   ├── vite.config.js
│   └── package.json
└── backend/
    ├── server.js
    └── package.json
```

### package.json (frontend)

```json
{
  "name": "<dapp-name>",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@primuslabs/zktls-js-sdk": "latest"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

Note: **No ethers dependency needed** for this SDK unless you independently need wallet operations.

### vite.config.js

```js
import { defineConfig } from 'vite'
export default defineConfig({
  optimizeDeps: {
    include: ['@primuslabs/zktls-js-sdk'],
  },
  define: {
    global: 'globalThis',
  },
})
```

## Core Workflow

A complete DApp has two independent flows:

### A. Wallet Connect / Disconnect

The wallet address is used as the user identifier in `generateRequestParams`. Provide a connect button that toggles to a disconnect state once connected.

```js
// Connect
const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
userAddress = accounts[0];
// Update UI: show short address, enable attest button, change button to "Disconnect"

// Disconnect (no ethereum API for this — clear state only)
userAddress = '';
// Update UI: reset address display, disable attest button, change button to "Connect Wallet"

// Listen for account changes
window.ethereum.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    // user disconnected from wallet side
    userAddress = '';
    // reset UI
  } else {
    userAddress = accounts[0];
    // update UI
  }
});
```

Note: `window.ethereum` is not required for this SDK — wallet is only needed to get a user address. If the user prefers, they can also type their address manually. Always check `if (!window.ethereum)` before calling wallet methods and show a friendly message if not present.

### B. Attestation Flow (6 steps)

```
init(appId, appSecret?)         ← call at page load, before any button click
  ↓
[user clicks Connect → gets userAddress]
  ↓
generateRequestParams(templateId, userAddress)  →  request object
  ↓ [optional] request.setAttMode({ algorithmType: 'proxytls' | 'mpctls' })
  ↓ [optional] request.setAttConditions(attConditions)
  ↓ [optional] request.setAdditionParams(JSON.stringify({...}))
  ↓
request.toJsonString()  →  requestStr
  ↓
primusZKTLS.sign(requestStr)  →  signedRequestStr   ← TEST: frontend; PROD: backend
  ↓
primusZKTLS.startAttestation(signedRequestStr)  →  attestation
  ↓
primusZKTLS.verifyAttestation(attestation)  →  boolean
```

## Test Mode vs Production Mode

This is the **most important architectural decision**. Ask the user which they need before writing code.

### Test Mode (frontend-only, NOT for production)

```js
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';

const primusZKTLS = new PrimusZKTLS();
// appSecret is visible in browser — test only
await primusZKTLS.init(appId, appSecret);

const request = primusZKTLS.generateRequestParams(templateId, userAddress);
const requestStr = request.toJsonString();
const signedRequestStr = await primusZKTLS.sign(requestStr);  // signed locally
const attestation = await primusZKTLS.startAttestation(signedRequestStr);
const verifyResult = await primusZKTLS.verifyAttestation(attestation);
```

### Production Mode (appSecret lives only on backend)

**Frontend:**
```js
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';

const primusZKTLS = new PrimusZKTLS();
await primusZKTLS.init(appId);  // no appSecret here

const request = primusZKTLS.generateRequestParams(templateId, userAddress);
const requestStr = request.toJsonString();

// Call your backend to sign
const response = await fetch(`/primus/sign?signParams=${encodeURIComponent(requestStr)}`);
const { signResult } = await response.json();

const attestation = await primusZKTLS.startAttestation(signResult);
const verifyResult = await primusZKTLS.verifyAttestation(attestation);
```

**Backend (Node.js / Express):**
```js
const { PrimusZKTLS } = require('@primuslabs/zktls-js-sdk');
const express = require('express');
const app = express();

app.get('/primus/sign', async (req, res) => {
  const primusZKTLS = new PrimusZKTLS();
  await primusZKTLS.init(process.env.APP_ID, process.env.APP_SECRET);
  const signResult = await primusZKTLS.sign(req.query.signParams);
  res.json({ signResult });
});
```

## Working Rules

- **Never put `appSecret` in frontend code for production.** It must live in a backend environment variable. The test mode (both appId + appSecret in frontend) is explicitly documented as unsafe and is for local testing only.
- **Always call `init()` before any other SDK method.** The docs recommend calling it at page initialization time (not inside the attestation handler), so the SDK is ready when the user clicks.
- **`startAttestation()` requires the Primus browser extension.** If the extension is not installed, it will either hang silently or throw. Always surface this requirement clearly in the UI.
- **Never load the SDK via CDN or `await import()`.** `@primuslabs/zktls-js-sdk` must be bundled by Vite. Always include it as a static import.
- **Always include `define: { global: 'globalThis' }` in `vite.config.js`.** The SDK requires it.
- **`verifyAttestation()` must always be called after `startAttestation()`.** Never skip it — it validates Primus' signature on the attestation. Only proceed with business logic if it returns `true`.
- **`attestation.data` is a stringified JSON object.** Always parse it before displaying: `try { JSON.parse(attestation.data) } catch (_) {}`.
- **`algorithmType` in `setAttMode` is `'proxytls'` or `'mpctls'`.** Default is `proxytls`. Use `mpctls` if the target data source blocks proxy IPs (some CEXes do). This is set on the `request` object, not passed directly to `startAttestation`.
- **Do not confuse `setAttMode` syntax between SDKs.** In `zktls-js-sdk`: `request.setAttMode({ algorithmType: 'mpctls' })`. In `network-js-sdk`: pass `attMode: 'mpctls'` directly into `attest()`. These are different APIs.
- **`setAttConditions`, `setAttMode`, and `setAdditionParams` are all called on the `request` object** returned by `generateRequestParams()`, before calling `toJsonString()`.
- **For mobile support**, detect device type and pass `{ platform: platformDevice }` as third argument to `init()`. PC-only apps do not need this.

## Important SDK Facts

- Package: `@primuslabs/zktls-js-sdk` (enterprise) — different from `@primuslabs/network-js-sdk`
- Class: `PrimusZKTLS` (not `PrimusNetwork`)
- `init(appId, appSecret?, options?)` — `appSecret` optional in production frontend
- `generateRequestParams(templateId, userAddress)` returns a mutable request object
- `request.toJsonString()` serializes the request for signing
- `primusZKTLS.sign(requestStr)` returns a signed string — contains appId + signature
- `startAttestation(signedRequestStr)` triggers the Primus extension popup
- `verifyAttestation(attestation)` returns `true` / `false` — always check this
- `attestation.data` → stringified JSON of verified data fields
- `attestation.signatures` → array of attestor signatures
- `attestation.recipient` → user wallet address passed in `generateRequestParams`
- `attestation.timestamp` → unix timestamp of attestation execution
- Each `appId` has 100 free proof generations. To increase: contact https://t.me/primuslabs

## Attestation Data Fields

See `references/attestation-structure.md` for the full structure. Key fields to surface in UI:

```js
// After verifyAttestation returns true:
let data = attestation.data;
try { data = JSON.parse(attestation.data); } catch (_) {}
// data now contains the verified data fields from the template
// e.g. { screen_name: "alice" } for X account template
```

## main.js Structure (Test Mode)

Organize in this order to avoid temporal dead zone errors:

```
1. import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk'
2. Constants (APP_ID, APP_SECRET, TEMPLATE_ID)
3. State variables (walletAddress, isConnected)
4. DOM refs  ← must come before any function that references them
5. init() call — at module load time, not inside button handler
6. Helper functions (log, shortAddr, etc.)
7. Wallet connect handler (btn-connect click)
8. Wallet disconnect handler (btn-disconnect click, or toggle on same button)
9. window.ethereum.on('accountsChanged') listener
10. Attestation flow handler (btn-attest click)
11. showSuccess() / showError()
```

## attConditions Reference

The array structure is critical and a common source of bugs:
- **Outer array** → one element per **URL** in the template
- **Inner array** → one element per **field** within that URL

```js
// Plaintext (default) — no setAttConditions needed

// Single field, hashed
request.setAttConditions([[{ field: 'YOUR_FIELD', op: 'SHA256' }]]);

// Single field, conditional (returns true/false, raw value never revealed)
request.setAttConditions([[{ field: 'YOUR_FIELD', op: '>', value: '1000' }]]);
// Operators: '>' '<' '=' '!=' '>=' '<='

// ✅ Multiple fields from the SAME URL — put in the SAME inner array
request.setAttConditions([
  [
    { field: 'field1', op: 'SHA256' },           // field from URL 1
    { field: 'field2', op: '>', value: '100' },  // field from URL 1 (same URL!)
  ],
]);

// ✅ Fields from DIFFERENT URLs — each URL gets its own inner array
request.setAttConditions([
  [{ field: 'field1', op: 'SHA256' }],          // fields from URL 1
  [{ field: 'field2', op: '>', value: '100' }], // fields from URL 2
]);
```

**⚠️ Common mistake**: putting fields from the same URL into separate inner arrays.
Primus matches each inner array to a URL by index. If a field's inner array index doesn't
correspond to the correct URL, Primus ignores the condition and returns the raw plaintext value.

```js
// ❌ WRONG — field1 and field2 come from the same URL, but split into two inner arrays
//   Primus treats [1] as URL 2, which doesn't exist → field2 returns plaintext
request.setAttConditions([
  [{ field: 'field1', op: 'SHA256' }],
  [{ field: 'field2', op: 'SHA256' }],  // ← silently ignored, raw value returned
]);
```

## Reference Files

- `references/attestation-structure.md` — full attestation object shape, field descriptions, data parsing pattern
- `references/error-codes.md` — all error codes with causes and fixes
- `references/test-vs-production.md` — side-by-side architectural comparison with full code for both modes
