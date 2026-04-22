# Demo Catalog

This document is the single index for all runnable zkTLS demos in `binance-verifiable-skills`.

## Shared Notes

- All demos require:
  - `ZKTLS_APP_ID`
  - `ZKTLS_APP_SECRET`
- Signed-query helper flows additionally require:
  - `BINANCE_API_KEY`
  - `BINANCE_API_SECRET`
- Common optional flags:
  - `--timeout-ms <ms>`
  - `--skip-direct-fetch`
- All demos print a normalized `Attestation summary` contract documented in `references/response-contracts.md`.
- `localVerification: true` means the returned Primus attestation verified locally.
- Dynamic endpoints can return different values between the plain fetch and the attested request because they are separate requests made at different times.

## Reading This Catalog

- `Proof shape` describes the intended proof boundary, not whether a given endpoint has already been live-tested.
- Use the demo entrypoint as the source of truth for runnable flags.
- Large signed array endpoints can be implemented but still be weaker operationally than narrow signed object endpoints.

## Quick Matrix

| Demo | Category | Proof shape | Dynamic | Default target |
| --- | --- | --- | --- | --- |
| `demo:spot-price` | `spot` | `verifiable` | `yes` | one symbol price snapshot |
| `demo:spot-klines` | `spot` | `verifiable` | `yes` | latest candle only |
| `demo:spot-book-ticker` | `spot` | `verifiable` | `yes` | one top-of-book snapshot |
| `demo:spot-avg-price` | `spot` | `partial` | `yes` | one rolling average-price snapshot |
| `demo:spot-depth` | `spot` | `partial` | `yes` | top bid and ask from one depth snapshot |
| `demo:spot-account` | `spot` | `partial` | `medium` | one signed account metadata snapshot |
| `demo:spot-account-status` | `spot` | `partial` | `low` | one signed account-status snapshot |
| `demo:spot-account-info` | `spot` | `partial` | `low` | one signed account-info snapshot |
| `demo:spot-asset-balance` | `spot` | `partial` | `medium` | one signed spot asset balance row |
| `demo:spot-trade-fee` | `spot` | `partial` | `low` | one signed spot trade-fee row |
| `demo:spot-api-restrictions` | `spot` | `partial` | `low` | one signed API-permission snapshot |
| `demo:spot-api-trading-status` | `spot` | `partial` | `low` | one signed spot API-trading-status snapshot |
| `demo:spot-capital-config` | `spot` | `partial` | `medium` | one signed capital-config coin row |
| `demo:spot-bnb-burn` | `spot` | `partial` | `low` | one signed BNB-burn settings snapshot |
| `demo:spot-order-status` | `spot` | `partial` | `medium` | one signed order-status response |
| `demo:futures-premium-index` | `derivatives-usds-futures` | `partial` | `yes` | one futures premium-index snapshot |
| `demo:futures-funding-rate` | `derivatives-usds-futures` | `partial` | `yes` | latest funding-rate row |
| `demo:futures-open-interest` | `derivatives-usds-futures` | `partial` | `yes` | one open-interest snapshot |
| `demo:futures-position-risk` | `derivatives-usds-futures` | `partial` | `medium` | one signed position-risk row |
| `demo:futures-balance` | `derivatives-usds-futures` | `partial` | `medium` | one signed futures balance row |
| `demo:futures-account` | `derivatives-usds-futures` | `partial` | `medium` | one signed futures account snapshot |
| `demo:futures-api-trading-status` | `derivatives-usds-futures` | `partial` | `low` | one signed futures API-trading-status snapshot |
| `demo:futures-commission-rate` | `derivatives-usds-futures` | `partial` | `low` | one signed commission-rate snapshot |
| `demo:margin-all-pairs` | `margin-trading` | `verifiable` | `low` | one margin pair metadata row |
| `demo:margin-account` | `margin-trading` | `partial` | `medium` | one signed margin account snapshot |
| `demo:margin-max-borrowable` | `margin-trading` | `partial` | `medium` | one signed max-borrowable snapshot |
| `demo:margin-max-transferable` | `margin-trading` | `partial` | `medium` | one signed max-transferable snapshot |
| `demo:alpha-token-search` | `alpha` | `verifiable` | `medium` | top search match |

## Spot

### `demo:spot-price`

- Category: `spot`
- Endpoint: `GET /api/v3/ticker/price`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:spot-price -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `price`

### `demo:spot-klines`

- Category: `spot`
- Endpoint: `GET /api/v3/klines`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:spot-klines -- --symbol BTCUSDT --interval 1h --limit 1
```

- Attested fields:
  - `openTime`
  - `open`
  - `high`
  - `low`
  - `close`
  - `volume`
  - `closeTime`

### `demo:spot-book-ticker`

- Category: `spot`
- Endpoint: `GET /api/v3/ticker/bookTicker`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:spot-book-ticker -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `bidPrice`
  - `bidQty`
  - `askPrice`
  - `askQty`

### `demo:spot-avg-price`

- Category: `spot`
- Endpoint: `GET /api/v3/avgPrice`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-avg-price -- --symbol BTCUSDT
```

- Attested fields:
  - `mins`
  - `price`
  - `closeTime`

### `demo:spot-depth`

- Category: `spot`
- Endpoint: `GET /api/v3/depth`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-depth -- --symbol BTCUSDT --limit 5
```

- Attested fields:
  - `lastUpdateId`
  - `bestBidPrice`
  - `bestBidQty`
  - `bestAskPrice`
  - `bestAskQty`

### `demo:spot-account`

- Category: `spot`
- Endpoint: `GET /api/v3/account`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-account -- --omit-zero-balances true
```

- Attested fields:
  - `makerCommission`
  - `takerCommission`
  - `canTrade`
  - `canWithdraw`
  - `canDeposit`
  - `accountType`
  - `updateTime`

### `demo:spot-account-status`

- Category: `spot`
- Endpoint: `GET /sapi/v1/account/status`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-account-status
```

- Attested fields:
  - `status`

### `demo:spot-account-info`

- Category: `spot`
- Endpoint: `GET /sapi/v1/account/info`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-account-info
```

- Attested fields:
  - `vipLevel`
  - `isMarginEnabled`
  - `isFutureEnabled`
  - `isOptionsEnabled`
  - `isPortfolioMarginRetailEnabled`

### `demo:spot-asset-balance`

- Category: `spot`
- Endpoint: `GET /api/v3/account`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-asset-balance -- --asset USDT
```

- Attested fields:
  - `asset`
  - `free`
  - `locked`
- Note: this demo resolves the target balance row via the direct fetch response before building the attestation paths.

### `demo:spot-trade-fee`

- Category: `spot`
- Endpoint: `GET /sapi/v1/asset/tradeFee`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-trade-fee -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `makerCommission`
  - `takerCommission`

### `demo:spot-api-restrictions`

- Category: `spot`
- Endpoint: `GET /sapi/v1/account/apiRestrictions`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-api-restrictions
```

- Attested fields:
  - `ipRestrict`
  - `enableReading`
  - `enableSpotAndMarginTrading`
  - `enableWithdrawals`
  - `enableInternalTransfer`
  - `permitsUniversalTransfer`

### `demo:spot-api-trading-status`

- Category: `spot`
- Endpoint: `GET /sapi/v1/account/apiTradingStatus`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-api-trading-status
```

- Attested fields:
  - `isLocked`
  - `plannedRecoverTime`
  - `triggerConditionUFR`
  - `triggerConditionIFER`
  - `triggerConditionGCR`
  - `updateTime`

### `demo:spot-capital-config`

- Category: `spot`
- Endpoint: `GET /sapi/v1/capital/config/getall`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-capital-config -- --coin USDT
```

- Attested fields:
  - `coin`
  - `name`
  - `free`
  - `depositAllEnable`
  - `withdrawAllEnable`
  - `trading`
- Note: this demo resolves the target coin row via the direct fetch response before building the attestation paths.
- Note: the current live proof path can time out because Binance returns a large signed array for this endpoint.

### `demo:spot-bnb-burn`

- Category: `spot`
- Endpoint: `GET /sapi/v1/bnbBurn`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-bnb-burn
```

- Attested fields:
  - `spotBNBBurn`
  - `interestBNBBurn`

### `demo:spot-order-status`

- Category: `spot`
- Endpoint: `GET /api/v3/order`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:spot-order-status -- --symbol BTCUSDT --order-id <order_id>
```

- Attested fields:
  - `symbol`
  - `orderId`
  - `status`
  - `side`
  - `type`
  - `price`
  - `origQty`
  - `executedQty`
  - `time`

## Derivatives

### `demo:futures-premium-index`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v1/premiumIndex`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-premium-index -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `markPrice`
  - `indexPrice`
  - `estimatedSettlePrice`
  - `lastFundingRate`
  - `nextFundingTime`
  - `time`

### `demo:futures-funding-rate`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v1/fundingRate`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-funding-rate -- --symbol BTCUSDT --limit 1
```

- Attested fields:
  - `symbol`
  - `fundingRate`
  - `fundingTime`
  - `markPrice`

### `demo:futures-open-interest`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v1/openInterest`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-open-interest -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `openInterest`
  - `time`

### `demo:futures-position-risk`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v3/positionRisk`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-position-risk -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `positionAmt`
  - `entryPrice`
  - `markPrice`
  - `unRealizedProfit`
  - `liquidationPrice`
  - `leverage`
  - `positionSide`
- Note: this demo requires a non-empty position row for the selected symbol.

### `demo:futures-balance`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v3/balance`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-balance -- --asset USDT
```

- Attested fields:
  - `asset`
  - `balance`
  - `crossWalletBalance`
  - `crossUnPnl`
  - `availableBalance`
- Note: this demo resolves the asset row via the direct fetch response before building the attestation paths.

### `demo:futures-account`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v3/account`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-account
```

- Attested fields:
  - `totalInitialMargin`
  - `totalMaintMargin`
  - `totalWalletBalance`
  - `totalUnrealizedProfit`
  - `totalMarginBalance`
  - `availableBalance`
  - `maxWithdrawAmount`

### `demo:futures-api-trading-status`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v1/apiTradingStatus`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-api-trading-status
```

- Attested fields:
  - `updateTime`
  - `indicators`

### `demo:futures-commission-rate`

- Category: `derivatives-usds-futures`
- Endpoint: `GET /fapi/v1/commissionRate`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:futures-commission-rate -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `makerCommissionRate`
  - `takerCommissionRate`

## Margin

### `demo:margin-all-pairs`

- Category: `margin-trading`
- Endpoint: `GET /sapi/v1/margin/allPairs`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:margin-all-pairs -- --symbol BTCUSDT
```

- Attested fields:
  - `symbol`
  - `base`
  - `quote`
  - `isMarginTrade`
  - `isBuyAllowed`
  - `isSellAllowed`
- Note: in this environment, Binance currently returns `-2014` for this endpoint unless valid Binance API credentials are supplied.

### `demo:margin-account`

- Category: `margin-trading`
- Endpoint: `GET /sapi/v1/margin/account`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:margin-account
```

- Attested fields:
  - `borrowEnabled`
  - `tradeEnabled`
  - `transferEnabled`
  - `marginLevel`
  - `totalAssetOfBtc`
  - `totalLiabilityOfBtc`
  - `totalNetAssetOfBtc`

### `demo:margin-max-borrowable`

- Category: `margin-trading`
- Endpoint: `GET /sapi/v1/margin/maxBorrowable`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:margin-max-borrowable -- --asset USDT
```

- Attested fields:
  - `amount`
  - `borrowLimit`

### `demo:margin-max-transferable`

- Category: `margin-trading`
- Endpoint: `GET /sapi/v1/margin/maxTransferable`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:margin-max-transferable -- --asset USDT
```

- Attested fields:
  - `amount`

## Alpha

### `demo:alpha-token-search`

- Category: `alpha`
- Endpoint: `GET /bapi/defi/v5/public/wallet-direct/buw/wallet/market/token/search`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:alpha-token-search -- --keyword USDT --chain-ids 56
```

- Attested fields:
  - `code`
  - `success`
  - `symbol`
  - `name`
  - `price`
  - `marketCap`
