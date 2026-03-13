# Endpoint Catalog

This file tracks which OnchainOS-style capability groups are currently good candidates for zkTLS-backed verification.

## Coverage legend

- `verifiable`: good first-release target
- `partial`: some read-only calls fit, but not the whole category
- `fallback`: keep normal API flow for now

## Market

| Capability | Status | Notes |
|---|---|---|
| Single token price | `verifiable` | Strong fit for narrow JSON extraction |
| Batch prices | `partial` | Works when the token list is small and the response shape is stable |
| K-line / OHLC | `verifiable` | Good fit if the proof extracts a bounded number of bars or the latest bar |
| Index price | `verifiable` | Read-only aggregated value |
| Wallet PnL overview | `partial` | User-specific and likely auth-heavy |
| Wallet DEX history | `fallback` | Pagination and high-cardinality response make proofs heavy |
| Per-token PnL | `partial` | Useful but user-specific |

## Token

| Capability | Status | Notes |
|---|---|---|
| Token search | `verifiable` | Search result identity can be proven for a concrete query |
| Price info | `verifiable` | Similar to market price but token-oriented |
| Hot tokens / rankings | `verifiable` | Good if the query parameters are fixed and only key rank fields are revealed |
| Liquidity pools | `partial` | Prefer top pool summary instead of full pool expansion |
| Holder distribution | `partial` | Good for summary metrics, weaker for large holder lists |
| Advanced info / safety flags | `partial` | Risk tags may work if the response shape is stable |
| Top traders | `fallback` | High churn and large result sets |
| Filtered trade history | `fallback` | Too dynamic for first release |

## Wallet Portfolio

| Capability | Status | Notes |
|---|---|---|
| Supported chains | `verifiable` | Static-ish read endpoint |
| Total portfolio value | `partial` | User-specific and auth-sensitive |
| All balances | `partial` | Can prove a narrow subset, not ideal for full inventory |
| Specific token balances | `partial` | Better than all-balances because the field set is constrained |

## Swap

| Capability | Status | Notes |
|---|---|---|
| Supported chains | `verifiable` | Metadata endpoint |
| Liquidity source list | `verifiable` | Static-ish per-chain listing |
| Quote | `partial` | Best candidate in this category, but route volatility is high |
| Approve tx data | `fallback` | Better treated as transaction generation, not proof material |
| Swap tx data | `fallback` | Execution-prep output changes rapidly |

## Onchain Gateway

| Capability | Status | Notes |
|---|---|---|
| Supported chains | `verifiable` | Metadata endpoint |
| Gas price | `partial` | Feasible, but freshness is sensitive |
| Gas limit estimation | `partial` | Inputs are user-specific |
| Simulation | `partial` | Potentially useful, but endpoint semantics matter |
| Broadcast | `fallback` | Chain state and tx hash are stronger truth sources |
| Order tracking | `fallback` | Better treated as normal execution status |

## First implementation target

Start with:

1. Market price
2. Market K-line
3. Token search
4. Token price info
5. Token hot lists

Delay the rest until the concrete REST endpoints and JSON shapes are captured.

## Concrete endpoint templates

These templates convert the first-release targets into proof-friendly request and field mappings.

### Market price

- Status: `verifiable`
- Official endpoint: `POST https://web3.okx.com/api/v6/dex/market/price`
- Upstream response shape: `{ "code": "0", "data": [ { ... } ], "msg": "" }`
- Preferred request body:

```json
[
  {
    "chainIndex": "1",
    "tokenContractAddress": "0x0000000000000000000000000000000000000000"
  }
]
```

- Recommended proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].tokenContractAddress`
  - `$.data[0].time`
  - `$.data[0].price`

### Market candles

- Status: `verifiable`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/market/candles`
- Upstream response shape: `{ "code": "0", "data": [ [ts,o,h,l,c,vol,volUsd,confirm], ... ], "msg": "" }`
- Preferred query shape:

```text
?chainIndex=501&tokenContractAddress=So11111111111111111111111111111111111111112&bar=1H&limit=1
```

- Recommended proof fields for the latest bar:
  - `$.data[0][0]` as `ts`
  - `$.data[0][1]` as `open`
  - `$.data[0][2]` as `high`
  - `$.data[0][3]` as `low`
  - `$.data[0][4]` as `close`
  - `$.data[0][7]` as `confirm`

### Token search

- Status: `verifiable`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/market/token/search`
- Upstream response shape: `{ "code": "0", "data": [ { ... } ], "msg": "" }`
- Preferred query shape:

```text
?chains=501&search=BONK
```

- Recommended proof fields for the best match:
  - `$.data[0].chainIndex`
  - `$.data[0].tokenContractAddress`
  - `$.data[0].tokenName`
  - `$.data[0].tokenSymbol`
  - `$.data[0].price`
  - `$.data[0].tagList.communityRecognized`

### Token basic info

- Status: `verifiable`
- Official endpoint: `POST https://web3.okx.com/api/v6/dex/market/token/basic-info`
- Upstream response shape: `{ "code": "0", "data": [ { ... } ], "msg": "" }`
- Preferred request body:

```json
[
  {
    "chainIndex": "501",
    "tokenContractAddress": "So11111111111111111111111111111111111111112"
  }
]
```

- Recommended proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].tokenContractAddress`
  - `$.data[0].tokenName`
  - `$.data[0].tokenSymbol`
  - `$.data[0].decimal`
  - `$.data[0].tagList.communityRecognized`

### Token price info

- Status: `verifiable`
- Official endpoint: `POST https://web3.okx.com/api/v6/dex/market/price-info`
- Upstream response shape: `{ "code": "0", "data": [ { ... } ], "msg": "" }`
- Preferred request body:

```json
[
  {
    "chainIndex": "501",
    "tokenContractAddress": "So11111111111111111111111111111111111111112"
  }
]
```

- Recommended proof fields:
  - `$.data[0].time`
  - `$.data[0].price`
  - `$.data[0].marketCap`
  - `$.data[0].liquidity`
  - `$.data[0].holders`
  - `$.data[0].priceChange24H`

### Token hot-token ranking

- Status: `verifiable`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/market/token/hot-token`
- Upstream response shape: `{ "code": "0", "data": [ { ... } ], "msg": "" }`
- Preferred query shape:

```text
?rankingType=4&chainIndex=501&rankingTimeFrame=2
```

- Recommended proof fields for top row:
  - `$.data[0].chainIndex`
  - `$.data[0].tokenContractAddress`
  - `$.data[0].tokenSymbol`
  - `$.data[0].price`
  - `$.data[0].marketCap`
  - `$.data[0].liquidity`
  - `$.data[0].riskLevelControl`

## Notes

- The OKX REST responses observed here wrap useful results under `data`, which is commonly an array.
- Proof rules should target specific array positions such as `$.data[0].price`, not broad object reveals.
- For list endpoints, the first release should only prove the top row or a tiny fixed prefix.

## Additional concrete templates

### Balance supported chains

- Status: `verifiable`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/balance/supported/chain`
- Upstream response shape: `{ "code": "0", "data": [ { ... } ], "msg": "" }`
- Recommended proof fields for the first row:
  - `$.data[0].chainIndex`
  - `$.data[0].name`
  - `$.data[0].shortName`

### Balance total value

- Status: `partial`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/balance/total-value-by-address`
- Preferred query shape:

```text
?address=0xabc...&chains=1&assetType=0
```

- Recommended proof fields:
  - `$.data[0].totalValue`

### Balance all token balances

- Status: `partial`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/balance/all-token-balances-by-address`
- Recommended first-release strategy:
  - do not prove the full inventory
  - narrow to a single row only if the token ordering is explicitly part of the query
- Example fields for first row only:
  - `$.data[0].tokenAssets[0].chainIndex`
  - `$.data[0].tokenAssets[0].tokenContractAddress`
  - `$.data[0].tokenAssets[0].symbol`
  - `$.data[0].tokenAssets[0].balance`
  - `$.data[0].tokenAssets[0].tokenPrice`

### Balance specific token balances

- Status: `partial`
- Official endpoint: `POST https://web3.okx.com/api/v6/dex/balance/token-balances-by-address`
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

- Recommended proof fields:
  - `$.data[0].tokenAssets[0].chainIndex`
  - `$.data[0].tokenAssets[0].tokenContractAddress`
  - `$.data[0].tokenAssets[0].symbol`
  - `$.data[0].tokenAssets[0].balance`
  - `$.data[0].tokenAssets[0].tokenPrice`
  - `$.data[0].tokenAssets[0].isRiskToken`

### Swap supported chains

- Status: `verifiable`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/aggregator/supported/chain`
- Recommended proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].chainName`
  - `$.data[0].dexTokenApproveAddress`

### Swap liquidity sources

- Status: `verifiable`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/aggregator/get-liquidity`
- Preferred query shape:

```text
?chainIndex=1
```

- Recommended proof fields for top row:
  - `$.data[0].id`
  - `$.data[0].name`
  - `$.data[0].logo`

### Swap quote

- Status: `partial`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/aggregator/quote`
- Preferred query shape:

```text
?chainIndex=1&amount=1000000&swapMode=exactIn&fromTokenAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&toTokenAddress=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
```

- Recommended proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].fromTokenAmount`
  - `$.data[0].toTokenAmount`
  - `$.data[0].tradeFee`
  - `$.data[0].estimateGasFee`
  - `$.data[0].dexRouterList[0].toToken.tokenContractAddress`
  - `$.data[0].dexRouterList[0].toToken.tokenSymbol`
  - `$.data[0].priceImpactPercent`

### Gateway supported chains

- Status: `verifiable`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/pre-transaction/supported/chain`
- Recommended proof fields:
  - `$.data[0].chainIndex`
  - `$.data[0].name`
  - `$.data[0].shortName`

### Gateway gas price

- Status: `partial`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/pre-transaction/gas-price`
- Preferred query shape:

```text
?chainIndex=1
```

- Recommended proof fields for EVM:
  - `$.data[0].normal`
  - `$.data[0].min`
  - `$.data[0].max`
  - `$.data[0].supportEip1559`
  - `$.data[0].eip1599Protocol.suggestBaseFee`
  - `$.data[0].eip1599Protocol.proposePriorityFee`

### Gateway gas limit

- Status: `partial`
- Official endpoint: `POST https://web3.okx.com/api/v6/dex/pre-transaction/gas-limit`
- Recommended proof fields:
  - `$.data[0].gasLimit`

### Gateway simulate

- Status: `partial`
- Official endpoint: `GET https://web3.okx.com/api/v6/dex/pre-transaction/simulate`
- Constraints:
  - currently whitelisted customers only
  - highly input-specific
- Recommended proof fields:
  - `$.data[0].intention`
  - `$.data[0].gasUsed`
  - `$.data[0].failReason`
  - `$.data[0].assetChange[0].symbol`
  - `$.data[0].assetChange[0].rawValue`
