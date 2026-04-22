---
name: binance-verifiable-spot
description: Generate verifiable Binance Spot API calls using Primus zkTLS. Use when the user asks for spot price snapshots, latest spot candles, narrow symbol lookups, or other read-only spot market claims that should be backed by an attestation.
---

# Binance Verifiable Spot

Use this skill together with `primus-zktls-core-sdk` when the user wants Binance Spot market data with a proof.

## Scope

Prefer this skill for:

- current symbol price
- latest kline or OHLC bar
- top-of-book snapshots
- rolling average price
- narrow depth snapshots
- small symbol-level spot market snapshots
- signed account metadata snapshots
- signed account-status lookups
- signed account-info lookups
- signed asset-balance lookups
- signed trade-fee lookups
- signed API-permission lookups
- signed API-trading-status lookups
- signed capital-config lookups
- signed BNB-burn status lookups
- signed order-status lookups

Do not force this skill for:

- deep order books
- long kline windows
- order placement or cancel flows

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/endpoint-catalog.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/limitations.md`

## Workflow

1. Reduce the prompt to one symbol and one narrow claim.
2. Select the smallest Spot endpoint that answers it.
3. Reveal only the fields needed for the user-visible claim.
4. Generate and verify the attestation when the payload stays small.
5. If the request is broad, offer a latest-snapshot proof instead.

## Default proof patterns

### Symbol price

Recommended endpoint:

- `GET https://api.binance.com/api/v3/ticker/price`

Preferred query pattern:

```text
?symbol=BTCUSDT
```

Reveal only:

- `symbol`
- `price`

### Latest kline

Recommended endpoint:

- `GET https://api.binance.com/api/v3/klines`

Preferred query pattern:

```text
?symbol=BTCUSDT&interval=1h&limit=1
```

Reveal only:

- `openTime`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `closeTime`

### Book ticker

Recommended endpoint:

- `GET https://api.binance.com/api/v3/ticker/bookTicker`

Reveal only:

- `symbol`
- `bidPrice`
- `bidQty`
- `askPrice`
- `askQty`

### Average price

Recommended endpoint:

- `GET https://api.binance.com/api/v3/avgPrice`

Reveal only:

- `mins`
- `price`
- `closeTime`

### Narrow depth snapshot

Recommended endpoint:

- `GET https://api.binance.com/api/v3/depth`

First-release rule:

- keep `limit` small
- reveal only `lastUpdateId` plus the best bid and best ask

### Signed account metadata

Recommended endpoint:

- `GET https://api.binance.com/api/v3/account`

First-release rule:

- prove account metadata only
- do not try to prove the full balances array

Reveal only:

- `makerCommission`
- `takerCommission`
- `canTrade`
- `canWithdraw`
- `canDeposit`
- `accountType`
- `updateTime`

### Signed account status

Recommended endpoint:

- `GET https://api.binance.com/sapi/v1/account/status`

Reveal only:

- `data`

### Signed account info

Recommended endpoint:

- `GET https://api.binance.com/sapi/v1/account/info`

Reveal only:

- `vipLevel`
- `isMarginEnabled`
- `isFutureEnabled`
- `isOptionsEnabled`
- `isPortfolioMarginRetailEnabled`

### Signed order status

Recommended endpoint:

- `GET https://api.binance.com/api/v3/order`

First-release rule:

- require one explicit `orderId` or `origClientOrderId`
- prove only the returned order object

### Signed asset balance

Recommended endpoint:

- `GET https://api.binance.com/api/v3/account`

First-release rule:

- find the target asset row from the direct response
- prove only `asset`, `free`, and `locked`

### Signed trade fee

Recommended endpoint:

- `GET https://api.binance.com/sapi/v1/asset/tradeFee`

Reveal only:

- `symbol`
- `makerCommission`
- `takerCommission`

### Signed API restrictions

Recommended endpoint:

- `GET https://api.binance.com/sapi/v1/account/apiRestrictions`

Reveal only:

- `ipRestrict`
- `enableReading`
- `enableSpotAndMarginTrading`
- `enableWithdrawals`
- `enableInternalTransfer`
- `permitsUniversalTransfer`

### Signed API trading status

Recommended endpoint:

- `GET https://api.binance.com/sapi/v1/account/apiTradingStatus`

Reveal only:

- `isLocked`
- `plannedRecoverTime`
- `triggerCondition.UFR`
- `triggerCondition.IFER`
- `triggerCondition.GCR`
- `updateTime`

### Signed capital config

Recommended endpoint:

- `GET https://api.binance.com/sapi/v1/capital/config/getall`

First-release rule:

- find the target coin row from the direct response
- prove only `coin`, `name`, `free`, `depositAllEnable`, `withdrawAllEnable`, and `trading`
- treat the proof path as best-effort because the endpoint returns a large signed array

### Signed BNB burn status

Recommended endpoint:

- `GET https://api.binance.com/sapi/v1/bnbBurn`

Reveal only:

- `spotBNBBurn`
- `interestBNBBurn`

## Output contract

For a verifiable reply, structure the result around:

- `claim`
- `extracted fields`
- `proof status`
- `local verification`

Never imply a full chart history was verified when only the latest candle was proven.
