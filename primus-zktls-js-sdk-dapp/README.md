# primus-zktls-js-sdk-dapp skill

A reusable skill for AI agents to scaffold frontend DApps using `@primuslabs/zktls-js-sdk` — the **enterprise** Primus zkTLS SDK.

## What this skill teaches

- How to install and init `@primuslabs/zktls-js-sdk`
- The 6-step attestation flow: `init → generateRequestParams → toJsonString → sign → startAttestation → verifyAttestation`
- Test mode (appSecret in frontend) vs Production mode (appSecret on backend only)
- How to set `attMode` (proxytls / mpctls), `attConditions` (hash / comparison), `additionParams`
- How to parse and verify the attestation result
- Error code reference with causes and fixes
- How this SDK differs from `@primuslabs/network-js-sdk`

## Files

```
primus-zktls-js-sdk-dapp/
├── SKILL.md                            ← main instructions for the agent
├── README.md                           ← this file
├── package.json                        ← npm run doctor
├── references/
│   ├── attestation-structure.md        ← full attestation object + parsing patterns
│   ├── error-codes.md                  ← all error codes with causes and fixes
│   └── test-vs-production.md           ← complete code for both modes
└── scripts/
    └── doctor.mjs                      ← validates a generated DApp project
```

## How to use (for agents)

Read `SKILL.md` first. It contains the trigger prompt, prerequisites checklist, core workflow, working rules, and main.js structure order.

For deeper reference, read the files in `references/` as needed.

To validate a generated project:
```bash
node scripts/doctor.mjs <path-to-project>
```

## Key distinction from network-js-sdk

| | `zktls-js-sdk` (this skill) | `network-js-sdk` |
|---|---|---|
| Auth | `appId` + `appSecret` | Wallet |
| On-chain tx | Not needed | Required (gas) |
| Class | `PrimusZKTLS` | `PrimusNetwork` |
| Flow | `generateRequestParams → sign → startAttestation` | `submitTask → attest` |

## Last updated

March 2026, based on docs at https://docs.primuslabs.xyz/enterprise/zk-tls-sdk/
