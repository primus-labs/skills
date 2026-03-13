---
name: okx-verifiable-dex-swap
description: Plan and apply verifiable swap-related calls for OKX OnchainOS-style workflows using Primus zkTLS. Use when the user asks for swap quotes, route summaries, liquidity-source metadata, approval data, or swap-preparation results and wants the request/response pair optionally backed by a proof. Distinguish clearly between proving the API response and proving final on-chain execution.
---

# OKX Verifiable DEX Swap

This is a quote-first skill for swap proofs, but action-oriented swap endpoints may also be attested if the user wants that extra assurance.

## Current status

- supported chains: good candidate
- liquidity source list: good candidate
- swap quote: partial candidate
- approve tx generation: opt-in proof candidate
- swap tx generation: opt-in proof candidate

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/verification-choice-prompts.md`
- `../../references/interaction-examples.md`
- `../../references/endpoint-catalog.md`
- `../../references/limitations.md`

## How to use this skill

1. Separate read-only quote questions from execution questions.
2. If the user wants a proof, prefer proving:
   - quoted output amount
   - route summary
   - price impact
   - liquidity source metadata
3. For approve or swap-prep endpoints, ask whether the user wants:
   - fast path
   - request/response proof
   - request/response proof plus later chain confirmation
4. Do not claim that a proof of a quote or calldata response is a proof that the later swap executed.

## First-release guidance

- Good proof target:
  - "Prove the quote for swapping token A to token B right now"
- Higher-cost proof target:
  - "Prove the approval calldata response"
- Weak proof target:
  - "Prove the final swap transaction settled" without a chain-native finality check

## Concrete endpoint templates

### Supported chains

- Endpoint: `GET https://web3.okx.com/api/v6/dex/aggregator/supported/chain`
- Good proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].chainName`
  - `$.data[0].dexTokenApproveAddress`

### Liquidity sources

- Endpoint: `GET https://web3.okx.com/api/v6/dex/aggregator/get-liquidity`
- Query pattern:

```text
?chainIndex=1
```

- Good proof fields for the first row:
  - `$.data[0].id`
  - `$.data[0].name`
  - `$.data[0].logo`

### Quote

- Endpoint: `GET https://web3.okx.com/api/v6/dex/aggregator/quote`
- Query pattern:

```text
?chainIndex=1&amount=1000000&swapMode=exactIn&fromTokenAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&toTokenAddress=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
```

- Good proof fields:
  - `$.data[0].fromTokenAmount`
  - `$.data[0].toTokenAmount`
  - `$.data[0].tradeFee`
  - `$.data[0].estimateGasFee`
  - `$.data[0].priceImpactPercent`
  - `$.data[0].dexRouterList[0].toToken.tokenSymbol`

### Approve transaction

- Endpoint: `GET https://web3.okx.com/api/v6/dex/aggregator/approve-transaction`
- Current policy:
  - allow as opt-in proof
  - label it as `request/response pair` or `execution-prep data`
  - never imply it proves a later approval transaction was mined

## Output contract

Prefer these reply modes:

- `attested` for supported chains and liquidity-source metadata
- `partial` for quote summary
- `attested` or `partial` for approve / swap-prep data when the user explicitly wants proof
- `fallback` only when the user prefers speed or the payload is too unstable

For quote replies, separate:

- verified subclaim: quoted output, route summary, price impact
- unverified remainder: approval, signing, broadcast, and settlement

For action-attested replies, also state:

- proof scope: `request/response pair`
- finality note: `chain confirmation still required`

## Fallback policy

If the user moves from quote to execution:

1. keep the quote proof separate
2. ask whether they want proof for the approval or swap-prep response too
3. route the final transaction status to gateway or chain-native verification

## Decision tree

1. Is the request chain support metadata or liquidity-source metadata?
   - yes -> attested
2. Is it a quote summary for one concrete swap?
   - yes -> partial or attested, depending on payload size
3. Is it approval generation or swap calldata?
   - yes -> ask user whether to use fast path or prove the request/response pair
4. Is it whether the swap completed?
   - use chain-native confirmation, optionally paired with attested API responses from earlier steps
