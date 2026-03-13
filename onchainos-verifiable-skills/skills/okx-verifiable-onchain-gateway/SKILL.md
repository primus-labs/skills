---
name: okx-verifiable-onchain-gateway
description: Plan and apply verifiable gateway-related calls for OKX OnchainOS-style workflows using Primus zkTLS. Use when the user asks for supported chains, gas snapshots, transaction simulation summaries, broadcast responses, or order tracking and wants the request/response pair optionally backed by a proof. Distinguish clearly between proving the API response and proving final on-chain settlement.
---

# OKX Verifiable Onchain Gateway

This is a simulation-first gateway proof skill, but action-oriented gateway endpoints may also be attested if the user wants them.

## Current status

- supported chains: good candidate
- gas price snapshot: partial candidate
- gas limit estimation: partial candidate
- simulation summary: partial candidate
- broadcast: opt-in proof candidate
- order tracking: opt-in proof candidate

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/verification-choice-prompts.md`
- `../../references/interaction-examples.md`
- `../../references/endpoint-catalog.md`
- `../../references/limitations.md`

## How to use this skill

1. Distinguish read-only gateway queries from transaction execution.
2. Prefer proofs for:
   - supported chain metadata
   - one gas snapshot
   - one bounded simulation result
3. For broadcast and order endpoints, ask whether the user wants:
   - fast path
   - request/response proof
   - request/response proof plus chain finality check
4. Treat tx hash confirmation and settlement as chain-truth problems, not zkTLS problems alone.

## First-release guidance

- Good proof target:
  - "Prove the current gas snapshot on chain X"
- Possible proof target:
  - "Prove that this simulated call returned success and gas estimate Y"
- Higher-cost proof target:
  - "Prove the broadcast API response"
- Weak proof target:
  - "Prove that my transaction settled" without a chain-native finality check

## Concrete endpoint templates

### Supported chains

- Endpoint: `GET https://web3.okx.com/api/v6/dex/pre-transaction/supported/chain`
- Good proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].name`
  - `$.data[0].shortName`

### Gas price

- Endpoint: `GET https://web3.okx.com/api/v6/dex/pre-transaction/gas-price`
- Query pattern:

```text
?chainIndex=1
```

- Good proof fields for EVM:
  - `$.data[0].normal`
  - `$.data[0].min`
  - `$.data[0].max`
  - `$.data[0].supportEip1559`
  - `$.data[0].eip1599Protocol.suggestBaseFee`
  - `$.data[0].eip1599Protocol.proposePriorityFee`

### Gas limit

- Endpoint: `POST https://web3.okx.com/api/v6/dex/pre-transaction/gas-limit`
- Good proof field:
  - `$.data[0].gasLimit`

### Simulate

- Endpoint: `GET https://web3.okx.com/api/v6/dex/pre-transaction/simulate`
- Important note:
  - this API is documented as whitelisted-only
- Good proof fields:
  - `$.data[0].intention`
  - `$.data[0].gasUsed`
  - `$.data[0].failReason`
  - `$.data[0].assetChange[0].symbol`
  - `$.data[0].assetChange[0].rawValue`

### Broadcast and orders

- Allow as opt-in proof targets for the request/response pair.
- Always pair them with a finality note.
- Treat tx hash and chain confirmation as the stronger truth source for settlement.

## Output contract

Prefer these reply modes:

- `attested` for supported-chain metadata
- `partial` for gas snapshots, gas-limit estimates, and simulation summaries
- `attested` or `partial` for broadcast and order responses when the user explicitly wants proof
- `fallback` when the user prefers speed or when finality is the real need

For simulation replies, separate:

- verified subclaim: intention, gas used, fail reason, or first asset change
- unverified remainder: final settlement outcome

For broadcast or orders replies, also state:

- proof scope: `request/response pair`
- finality note: `tx hash and chain confirmation still determine settlement`

## Fallback policy

For broadcast or tracking:

1. ask whether the user wants proof for the gateway response
2. if yes, prove the request/response pair
3. rely on transaction hash and chain confirmation for final settlement

## Decision tree

1. Is the request about supported chains only?
   - yes -> attested
2. Is it one gas snapshot, gas-limit estimate, or one simulation summary?
   - yes -> partial
3. Is it broadcast confirmation or order tracking?
   - ask whether the user wants a fast path or a request/response proof
4. Is the user actually asking about final settlement?
   - use chain-native confirmation and present gateway proofs as supplementary
