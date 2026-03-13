# Demo Catalog

This document is the single index for all runnable zkTLS demos in `onchainos-verifiable-skills`.

## Shared Notes

- All demos require:
  - `OKX_API_KEY`
  - `OKX_SECRET_KEY`
  - `OKX_PASSPHRASE`
  - `ZKTLS_APP_ID`
  - `ZKTLS_APP_SECRET`
- Common optional flags:
  - `--timeout-ms <ms>`
  - `--skip-direct-fetch`
- `localVerification: true` means the returned Primus attestation verified locally.
- Dynamic endpoints can return different values between the plain API fetch and the attested request because they are separate requests made at different times.

## Quick Matrix

| Demo | Category | Proof shape | Dynamic | Default target |
| --- | --- | --- | --- | --- |
| `demo:market-price` | `dex-market` | `verifiable` | `yes` | native token price snapshot |
| `demo:token-search` | `dex-token` | `verifiable` | `low` | top search match |
| `demo:token-basic-info` | `dex-token` | `verifiable` | `low` | stable token metadata |
| `demo:wallet-token-balance` | `wallet-portfolio` | `partial` | `medium` | one wallet-token subclaim |
| `demo:wallet-total-value` | `wallet-portfolio` | `partial` | `yes` | one portfolio value snapshot |
| `demo:gas-price` | `onchain-gateway` | `partial` | `yes` | one gas snapshot |
| `demo:gateway-supported-chains` | `onchain-gateway` | `verifiable` | `low` | supported chain metadata |
| `demo:swap-supported-chains` | `dex-swap` | `verifiable` | `low` | supported swap chains |
| `demo:swap-liquidity` | `dex-swap` | `verifiable` | `medium` | top liquidity source |
| `demo:swap-quote` | `dex-swap` | `partial` | `yes` | one quote response |

## By Category

- `dex-market`
  - `demo:market-price`
- `dex-token`
  - `demo:token-search`
  - `demo:token-basic-info`
- `wallet-portfolio`
  - `demo:wallet-token-balance`
  - `demo:wallet-total-value`
- `onchain-gateway`
  - `demo:gas-price`
  - `demo:gateway-supported-chains`
- `dex-swap`
  - `demo:swap-supported-chains`
  - `demo:swap-liquidity`
  - `demo:swap-quote`

## Market

### `demo:market-price`

- Category: `dex-market`
- Endpoint: `POST /api/v6/dex/market/price`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:market-price -- --chain-index 1 --token-address 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
```

- Attested fields:
  - `chainIndex`
  - `tokenContractAddress`
  - `time`
  - `price`
- Best use: prove a narrow token price snapshot.

### `demo:token-search`

- Category: `dex-token`
- Endpoint: `GET /api/v6/dex/market/token/search`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:token-search -- --chains 501 --query BONK
```

- Attested fields:
  - `chainIndex`
  - `tokenContractAddress`
  - `tokenSymbol`
  - `tokenName`
  - `tagList.communityRecognized`
- Best use: prove the top search match for a token query.

### `demo:token-basic-info`

- Category: `dex-token`
- Endpoint: `POST /api/v6/dex/market/token/basic-info`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:token-basic-info -- --chain-index 501 --token-address So11111111111111111111111111111111111111112
```

- Attested fields:
  - `chainIndex`
  - `tokenContractAddress`
  - `tokenName`
  - `tokenSymbol`
  - `decimal`
  - `tagList.communityRecognized`
- Best use: prove stable token metadata for one asset.

## Wallet Portfolio

### `demo:wallet-token-balance`

- Category: `wallet-portfolio`
- Endpoint: `POST /api/v6/dex/balance/token-balances-by-address`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:wallet-token-balance -- --address 0x28C6c06298d514Db089934071355E5743bf21d60 --chain-index 1 --token-address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
```

- Attested fields:
  - `chainIndex`
  - `tokenContractAddress`
  - `symbol`
  - `balance`
  - `tokenPrice`
  - `isRiskToken`
- Best use: prove one wallet-token balance subclaim instead of a full portfolio.

### `demo:wallet-total-value`

- Category: `wallet-portfolio`
- Endpoint: `GET /api/v6/dex/balance/total-value-by-address`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:wallet-total-value -- --address 0x28C6c06298d514Db089934071355E5743bf21d60 --chains 1 --asset-type 0
```

- Attested fields:
  - `totalValue`
- Best use: prove one portfolio value snapshot.
- Note: this is a high-dynamic endpoint, so plain fetch and attested values may differ slightly.

## Gateway

### `demo:gas-price`

- Category: `onchain-gateway`
- Endpoint: `GET /api/v6/dex/pre-transaction/gas-price`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:gas-price -- --chain-index 1
```

- Attested fields:
  - `normal`
  - `min`
  - `max`
  - `supportEip1559`
  - `eip1559Protocol.suggestBaseFee`
  - `eip1559Protocol.proposePriorityFee`
- Best use: prove one gas snapshot for a chain.

### `demo:gateway-supported-chains`

- Category: `onchain-gateway`
- Endpoint: `GET /api/v6/dex/pre-transaction/supported/chain`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:gateway-supported-chains
```

- Attested fields:
  - `chainIndex`
  - `name`
  - `shortName`
- Best use: prove gateway-supported chain metadata.

## Swap

### `demo:swap-supported-chains`

- Category: `dex-swap`
- Endpoint: `GET /api/v6/dex/aggregator/supported/chain`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:swap-supported-chains
```

- Attested fields:
  - `chainIndex`
  - `chainName`
  - `dexTokenApproveAddress`
- Best use: prove swap-supported chain metadata.

### `demo:swap-liquidity`

- Category: `dex-swap`
- Endpoint: `GET /api/v6/dex/aggregator/get-liquidity`
- Proof shape: `verifiable`
- Default command:

```bash
npm run demo:swap-liquidity -- --chain-index 1
```

- Attested fields:
  - `id`
  - `name`
  - `logo`
- Best use: prove the top liquidity source for a chain.

### `demo:swap-quote`

- Category: `dex-swap`
- Endpoint: `GET /api/v6/dex/aggregator/quote`
- Proof shape: `partial`
- Default command:

```bash
npm run demo:swap-quote -- --chain-index 1 --amount 100000000 --swap-mode exactIn --from-token-address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 --to-token-address 0xdac17f958d2ee523a2206206994597c13d831ec7
```

- Attested fields:
  - `chainIndex`
  - `fromTokenAmount`
  - `toTokenAmount`
  - `tradeFee`
  - `estimateGasFee`
  - `toToken.tokenContractAddress`
  - `toToken.tokenSymbol`
  - `priceImpactPercent`
- Best use: prove one quote response with explicit proof scope.
- Note: this is a high-dynamic endpoint, so plain fetch and attested values may differ.

## Suggested Coverage

- Stable metadata demos:
  - `token-basic-info`
  - `gateway-supported-chains`
  - `swap-supported-chains`
  - `swap-liquidity`
- Dynamic snapshot demos:
  - `market-price`
  - `wallet-total-value`
  - `gas-price`
  - `swap-quote`
- Narrow wallet/token demos:
  - `token-search`
  - `wallet-token-balance`
