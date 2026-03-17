# primus-network-js-sdk-dapp

Build a frontend DApp that uses `@primuslabs/network-js-sdk` to prove off-chain data (for instance, exchange account ownership, asset holdings, social account identity and other web2 data fields) via zkTLS attestation.

## Trigger Prompt

```
Use the primus-network-js-sdk-dapp skill to scaffold a DApp that proves <what_to_prove>. The template ID is <template_id>.
```

## Repositories

- SDK docs: https://docs.primuslabs.xyz/build/for-dapp/example
- Install guide: https://docs.primuslabs.xyz/build/for-dapp/install
- Demo: https://github.com/primus-labs/zktls-demo/tree/main/network-sdk-example

## Prerequisites

Confirm the user has all of the following before writing any code. If anything is missing, point them to the relevant link first.

| Requirement | Notes |
|---|---|
| Node.js 18+ | Verify with `node -v`. See https://docs.primuslabs.xyz/build/for-dapp/install |
| Template ID | UUID obtained from https://dev.primuslabs.xyz. Ask for it if not provided. |
| Primus browser extension | Required for `attest()` to execute the zkTLS protocol. Install from https://primuslabs.xyz or https://chromewebstore.google.com/detail/primus/oeiomhmbaapihbilkfkhmlajkeegnjhe. Without it the attestation step will hang or fail silently. |
| Web3 wallet | Any browser wallet that injects `window.ethereum` (e.g. MetaMask, OKX Wallet, Coinbase Wallet). |
| ETH on target chain | Needed for `submitTask` gas. Default to Base Sepolia for development, Base mainnet for production. Faucets: https://www.alchemy.com/faucets/base-sepolia |

## Output

Always scaffold a complete Vite project. Write files to the working directory, zip, and return to the user.

```
<dapp-name>/
├── index.html
├── src/
│   ├── main.js
│   └── style.css
├── vite.config.js
├── package.json
└── README.md
```

### package.json

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
    "@primuslabs/network-js-sdk": "latest",
    "ethers": "^6.7.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

### vite.config.js

```js
import { defineConfig } from 'vite'
export default defineConfig({
  optimizeDeps: {
    include: ['@primuslabs/network-js-sdk', 'ethers'],
  },
  define: {
    global: 'globalThis',
  },
})
```

## Core Workflow

1. Collect `templateId` from the user. Ask if not provided. Note what is being proved — this drives UI copy.
2. Scaffold the Vite project with the structure above.
3. Initialize the SDK: `await primusNetwork.init(window.ethereum, chainId)`.
4. Call `submitTask({ templateId, address })` — triggers an on-chain transaction.
5. Spread both result objects into `attest()`.
6. Extract and display `attestResult[0].data` prominently — this is the verified payload.
7. Optionally call `verifyAndPollTaskResult` for on-chain finality confirmation.

## Working Rules

- Never load the SDK via CDN or `await import()`. `@primuslabs/network-js-sdk` is a CommonJS package — it must be bundled by Vite. A dynamic CDN import will fail with "Failed to fetch dynamically imported module".
- Always include `define: { global: 'globalThis' }` in `vite.config.js`. The SDK requires it.
- Declare all DOM refs before any function that uses them. In ES modules, `let`/`const` are not hoisted — referencing `logEl` inside a function before the `const logEl = ...` line throws a ReferenceError.
- Always spread both objects into `attest()`: `{ ...submitTaskParams, ...submitTaskResult }`. Missing either causes the call to fail.
- `attestResult` is an array. Always access `attestResult[0]`, never `attestResult.taskId` directly.
- Always try to parse `att.data` — it may arrive as a JSON string. Use `try { JSON.parse(att.data) } catch (_) {}` before displaying.
- Call `ensureCorrectChain()` after getting wallet accounts and before `primusNetwork.init()`. Handle error code `4902` by calling `wallet_addEthereumChain`. See `references/chains.md` for the full implementation.
- Default to Base Sepolia (`chainId: 84532`) for new projects. Use Base mainnet (`8453`) when the user specifies production.
- `verifyAndPollTaskResult` is optional — only include it when the user needs on-chain finality confirmation.

## Important SDK Facts

- `primusNetwork.supportedChainIds` → `[84532, 8453]`
- `submitTask({ templateId, address })` registers the task on-chain and returns `{ taskId, taskTxHash, taskAttestors }`.
- `attest(params)` triggers the Primus browser extension popup for user authentication with the target service. This is the longest-running step.
- `attest()` returns an **array**. The attestation object is at `[0]`.
- `attestResult[0].data` contains the verified off-chain payload. Always surface it in the UI and log it with `console.log`.
- `verifyAndPollTaskResult({ taskId, reportTxHash })` polls for on-chain confirmation. Default interval: 2000ms, timeout: 60s.
- The full `attestResult[0]` object can be POSTed to a backend for signature verification against Primus contracts.
- `attConditions` enables privacy-preserving proofs: `[{ field, op: "SHA256" }]` hashes the value; `[{ field, op: ">", value }]` proves a threshold without revealing the actual value.
- Set `allJsonResponseFlag: 'true'` and call `getAllJsonResponse(taskId)` to retrieve raw HTTP responses for zkVM computation.

## main.js Structure

Organize in this order to avoid temporal dead zone errors:

```
1. import { PrimusNetwork } from '@primuslabs/network-js-sdk'
2. Constants (TEMPLATE_ID, chainId)
3. State variables
4. DOM refs  ← must come before any function that references them
5. Helper functions (log, step state helpers)
6. ensureCorrectChain()
7. Wallet connect handler
8. Attestation flow handler
9. showSuccess() / showError()
```

## Reference Files

- `references/chains.md` — chain IDs, RPC URLs, `wallet_addEthereumChain` configs, `ensureCorrectChain()` implementation, faucet links.
