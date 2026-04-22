# primus-network-core-sdk skill

A reusable skill for AI agents to build backend Node.js programs using `@primuslabs/network-core-sdk` — the no-extension, server-side Primus zkTLS SDK.

## What this skill covers

- How `network-core-sdk` differs from `network-js-sdk` and `zktls-js-sdk`
- Full `requests[]` + `responseResolves[]` field reference
- Privacy ops: `REVEAL_STRING`, `SHA256`, `SHA256_EX`, comparison operators
- Multiple URL attestation (array index mapping rules)
- `attest()` options: `attMode`, `getAllJsonResponse`, `mTLS`
- DVC / zkVM workflow using `getAllJsonResponse`
- Mutual TLS (`mTLS`) client certificate support
- Chains reference (Base Sepolia / Base mainnet)
- Error codes with backend-specific causes and fixes
- **ethers v5** requirement (not v6)
- `verifyAndPollTaskResult` for on-chain confirmation

## Files

```
primus-network-core-sdk/
├── SKILL.md                         ← main instructions for the agent
├── README.md
├── package.json                     ← npm run doctor
├── references/
│   ├── attestation-structure.md     ← full attestation object + data parsing
│   ├── error-codes.md               ← all codes with backend-specific fixes
│   ├── chains.md                    ← chainId, RPC URLs, faucets
│   └── examples.md                  ← annotated full code for 7 patterns
└── scripts/
    └── doctor.mjs                   ← validates a generated project (17 checks)
```

## Key difference from other Primus SDKs

This SDK runs on the **server** with no browser or user interaction needed.
You provide the HTTP requests and credentials directly — the SDK handles the zkTLS protocol end-to-end.

## Validate a generated project

```bash
node scripts/doctor.mjs <path-to-project>
```

## Last updated

March 2026 — based on https://docs.primuslabs.xyz/build/for-backend/
