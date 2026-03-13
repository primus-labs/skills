---
name: okx-verifiable-wallet-portfolio
description: Plan and partially apply verifiable wallet-portfolio calls for OKX OnchainOS-style workflows using Primus zkTLS. Use when the user asks for wallet total value, token balances, or supported portfolio chains and wants to understand which parts can be attested today versus which parts still require a normal API fallback.
---

# OKX Verifiable Wallet Portfolio

This is a planning-first skill for wallet portfolio proofs.

## Current status

- supported chains: good candidate
- specific token balance queries: partial candidate
- total portfolio value: partial candidate
- full all-balances inventory: not a first-release proof target

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/interaction-examples.md`
- `../../references/endpoint-catalog.md`
- `../../references/limitations.md`

## How to use this skill

1. Determine whether the user needs:
   - chain support metadata
   - one token balance
   - one wallet total-value snapshot
   - or a full wallet inventory
2. Prefer the smallest claim that can be proven.
3. If the request is broad or auth-sensitive, explain that only a partial verifiable flow is currently modeled.

## First-release guidance

- Good proof target:
  - "Which chains are supported for portfolio queries?"
- Possible narrow target:
  - "Prove the balance of token X in wallet Y"
- Weak target:
  - "Show my full wallet across many chains with proof"

## Concrete endpoint templates

### Supported chains

- Endpoint: `GET https://web3.okx.com/api/v6/dex/balance/supported/chain`
- Good proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].name`
  - `$.data[0].shortName`

### Total value

- Endpoint: `GET https://web3.okx.com/api/v6/dex/balance/total-value-by-address`
- Query pattern:

```text
?address=0xabc...&chains=1&assetType=0
```

- Good proof field:
  - `$.data[0].totalValue`

### Specific token balance

- Endpoint: `POST https://web3.okx.com/api/v6/dex/balance/token-balances-by-address`
- Preferred request body:

```json
{
  "address": "0xabc...",
  "tokenContractAddresses": [
    {
      "chainIndex": "1",
      "tokenContractAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    }
  ]
}
```

- Good proof fields:
  - `$.data[0].tokenAssets[0].symbol`
  - `$.data[0].tokenAssets[0].balance`
  - `$.data[0].tokenAssets[0].tokenPrice`
  - `$.data[0].tokenAssets[0].isRiskToken`

### Full balances

- Endpoint: `GET https://web3.okx.com/api/v6/dex/balance/all-token-balances-by-address`
- First-release rule:
  - do not claim a full-wallet proof
  - only use this as a source for a narrower follow-up proof when needed

## Output contract

Prefer these reply modes:

- `attested` for supported-chain metadata
- `partial` for one total-value snapshot or one token balance
- `fallback` for full multi-chain wallet inventories

For `partial` replies, separate:

- verified subclaim: one balance or total-value snapshot
- unverified remainder: the rest of the wallet inventory

## Fallback policy

If the request is not yet modeled reliably, offer one of:

- a normal non-verifiable portfolio query
- a smaller per-token proof
- a proof of supported-chain metadata only

## Decision tree

1. Is the question about supported chains only?
   - yes -> attested
2. Is it one wallet total-value snapshot or one token balance?
   - yes -> partial
3. Is it a full wallet inventory across multiple chains or many tokens?
   - no -> fallback
