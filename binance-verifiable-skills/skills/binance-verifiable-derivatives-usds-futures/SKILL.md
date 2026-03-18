---
name: binance-verifiable-derivatives-usds-futures
description: Generate verifiable Binance USDS-M Futures API calls using Primus zkTLS. Use when the user asks for premium index, funding-related snapshots, or narrow futures market data claims that should be backed by an attestation.
---

# Binance Verifiable Derivatives USDS Futures

Use this skill together with `primus-zktls-core-sdk` when the user wants Binance futures data with a proof.

## Scope

Prefer this skill for:

- premium index
- funding-rate style snapshots
- latest funding-rate row
- open-interest snapshots
- narrow futures symbol claims
- signed position-risk lookups
- signed futures balance snapshots
- signed futures account snapshots
- signed futures API-trading-status snapshots
- signed futures commission-rate lookups

Do not force this skill for:

- order placement
- cancel-order flows
- wide position lists

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/endpoint-catalog.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/limitations.md`

## First release

Recommended endpoint:

- `GET https://fapi.binance.com/fapi/v1/premiumIndex`

Reveal only:

- `symbol`
- `markPrice`
- `indexPrice`
- `estimatedSettlePrice`
- `lastFundingRate`
- `nextFundingTime`
- `time`

Additional first-release endpoints:

- `GET https://fapi.binance.com/fapi/v1/fundingRate`
- `GET https://fapi.binance.com/fapi/v1/openInterest`
- `GET https://fapi.binance.com/fapi/v3/positionRisk`
- `GET https://fapi.binance.com/fapi/v3/balance`
- `GET https://fapi.binance.com/fapi/v3/account`
- `GET https://fapi.binance.com/fapi/v1/apiTradingStatus`
- `GET https://fapi.binance.com/fapi/v1/commissionRate`

Reveal only the latest or narrowest subclaim:

- funding rate row:
  - `symbol`
  - `fundingRate`
  - `fundingTime`
  - `markPrice`
- open interest:
  - `symbol`
  - `openInterest`
  - `time`
- position risk:
  - `symbol`
  - `positionAmt`
  - `entryPrice`
  - `markPrice`
  - `unRealizedProfit`
  - `liquidationPrice`
  - `leverage`
  - `positionSide`
- futures balance:
  - `asset`
  - `balance`
  - `crossWalletBalance`
  - `crossUnPnl`
  - `availableBalance`
- futures account:
  - `totalInitialMargin`
  - `totalMaintMargin`
  - `totalWalletBalance`
  - `totalUnrealizedProfit`
  - `totalMarginBalance`
  - `availableBalance`
  - `maxWithdrawAmount`
- futures commission rate:
  - `symbol`
  - `makerCommissionRate`
  - `takerCommissionRate`
- futures API trading status:
  - `updateTime`
  - `indicators`

For position-risk proofs, require a symbol that currently returns a non-empty position row.

## Guidance

- Treat the first release as snapshot proof, not long-history proof.
- For position-risk or balance data, use partial proof only after narrowing the payload.
- Never imply that a futures execution result is proven by a premium-index proof.
