---
name: binance-verifiable-margin-trading
description: Generate verifiable Binance Margin Trading API calls using Primus zkTLS. Use when the user asks for margin-related market snapshots or narrow query responses that can be proven without attesting a large private payload.
---

# Binance Verifiable Margin Trading

Use this skill together with `primus-zktls-core-sdk` when the user wants a narrow Binance Margin query backed by a proof.

## Scope

Prefer this skill for:

- margin price index
- small read-only margin snapshots
- signed margin account snapshots
- signed max-borrowable checks
- signed max-transferable checks

Do not force this skill for:

- borrow or repay actions
- transfer flows
- broad private account payloads

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/endpoint-catalog.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/limitations.md`

## First release

The first release models one stable public market-data endpoint:

- `GET https://api.binance.com/sapi/v1/margin/allPairs`

Reveal only:

- `symbol`
- `base`
- `quote`
- `isMarginTrade`
- `isBuyAllowed`
- `isSellAllowed`

Additional signed read-only endpoints:

- `GET https://api.binance.com/sapi/v1/margin/account`
- `GET https://api.binance.com/sapi/v1/margin/maxBorrowable`
- `GET https://api.binance.com/sapi/v1/margin/maxTransferable`

Reveal only the narrow account or borrow subclaim:

- margin account:
  - `borrowEnabled`
  - `tradeEnabled`
  - `transferEnabled`
  - `marginLevel`
  - `totalAssetOfBtc`
  - `totalLiabilityOfBtc`
  - `totalNetAssetOfBtc`
- max borrowable:
  - `amount`
  - `borrowLimit`
- max transferable:
  - `amount`

## Guidance

- Use signed private-query flows only when the user explicitly needs them.
- Be explicit that some `sapi` endpoints can drift into API-key-required behavior even when older docs or skill pages label them as market-data style queries.
- For private margin data, narrow to one asset or one order when possible.
- For action endpoints, explain that request-response proof is not the same as execution truth.
