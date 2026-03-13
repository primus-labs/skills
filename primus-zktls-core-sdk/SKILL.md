---
name: primus-zktls-core-sdk
description: Explain and apply Primus zkTLS Core SDK workflows, including request construction, attestation generation, local signature verification, and Solidity on-chain verification with zktls-contracts. Use when the user asks about zktls-core-sdk, Primus zkTLS, attestation payloads, response parse rules, or contract-side proof verification.
---

# Primus zkTLS Core SDK

Use this skill when the user wants to integrate `@primuslabs/zktls-core-sdk`, understand its interfaces, generate zkTLS attestations, or verify those attestations in Solidity with `zktls-contracts`.

## Repositories Covered

- `https://github.com/primus-labs/zktls-core-sdk`
- `https://github.com/primus-labs/zktls-contracts`

## What This Skill Should Help With

- Explain the SDK's exported types and main class.
- Show how to build `AttNetworkRequest` and `AttNetworkResponseResolve`.
- Show how to call `init()`, `generateRequestParams()`, and `startAttestation()`.
- Explain `proxytls` vs `mpctls`, `noProxy`, `requestInterval`, and attestation conditions.
- Verify attestations locally with the SDK.
- Verify attestations on-chain with `IPrimusZKTLS.verifyAttestation`.
- Explain contract-side attestor management with `setAttestor()` and `removeAttestor()`.

## Core Workflow

1. Install the SDK and provide `appId` plus `appSecret`.
2. Call `init(appId, appSecret, mode?)`.
3. Build one request or a batch of requests.
4. Build matching response resolve rules.
5. Call `generateRequestParams()`.
6. Optionally set `attMode`, `attConditions`, `additionParams`, `sslCipher`, `noProxy`, or `requestInterval`.
7. Call `startAttestation()`.
8. Use `verifyAttestation()` locally if needed.
9. Submit the returned `Attestation` object to a Solidity contract that calls `IPrimusZKTLS.verifyAttestation(attestation)`.

## Working Rules

- Default to `PrimusCoreTLS` as the main integration entrypoint.
- When documenting the SDK, distinguish clearly between:
  - SDK initialization
  - request/response description
  - attestation generation
  - local verification
  - on-chain verification
- When the user asks for examples, prefer realistic `GET` JSON API examples first.
- If the user needs chain integration, show both:
  - a consumer contract calling `verifyAttestation`
  - owner-side attestor configuration when self-hosting or managing a contract instance
- Be explicit that the SDK's local `verifyAttestation()` checks the recovered signer against the built-in Primus attestor address constant, while the on-chain contract validates against configured attestors in `_attestors`.

## Important SDK Facts

- `PrimusCoreTLS.init()` stores `appId` and `appSecret`, then initializes the algorithm backend.
- `generateRequestParams()` returns an `AttRequest` instance with defaults:
  - `attMode.algorithmType = "proxytls"`
  - `attMode.resultType = "plain"`
  - `sslCipher = "ECDHE-RSA-AES128-GCM-SHA256"`
  - `noProxy = true`
  - `requestInterval = -1`
- `startAttestation()` signs the request JSON with `appSecret`, sends it to the algorithm service, polls for the result, and resolves to a parsed `Attestation`.
- `verifyAttestation(attestation)` returns a boolean in the SDK.
- `IPrimusZKTLS.verifyAttestation(attestation)` is `view` and reverts when verification fails.

## Mode Selection Guidance

- Use `proxytls` unless the user explicitly needs or tests `mpctls`.
- For batched requests, supply:
  - `AttNetworkRequest[]`
  - `AttNetworkResponseResolve[][]`
- Use `attConditions` when the proof must enforce comparisons or field constraints, not just reveal fields.

## Contract Guidance

- Import `IPrimusZKTLS` and `Attestation` from `@primuslabs/zktls-contracts/src/IPrimusZKTLS.sol`.
- Consumer contracts usually only need to call `verifyAttestation(attestation)`.
- If managing a `PrimusZKTLS` deployment, the owner must ensure valid attestors are configured with `setAttestor()`.

## Reference Files

- Full usage guide: [references/usage-guide.md](references/usage-guide.md)
