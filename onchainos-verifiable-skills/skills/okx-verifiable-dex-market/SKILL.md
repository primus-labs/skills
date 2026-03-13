---
name: okx-verifiable-dex-market
description: Generate verifiable market-data calls for OKX OnchainOS-style workflows using Primus zkTLS. Use when the user asks for token prices, price snapshots, K-line/OHLC candles, index prices, or other read-only market data that should be backed by an attestation rather than a plain API response. Prefer this skill over non-verifiable market queries when a stable REST endpoint and a small set of JSON fields can satisfy the request.
---

# OKX Verifiable DEX Market

Use this skill together with `primus-zktls-core-sdk` when the user wants market data with a proof.

## Scope

Prefer this skill for:

- single token price
- batch prices for a small token list
- latest K-line / OHLC bars
- index price snapshots

Do not force this skill for:

- wallet PnL history
- long paginated trade history
- very large candle windows

Those cases may fall back to normal API usage or a narrower verifiable sub-query.

## Shared references

Read these when implementing or extending a proof:

- `../../references/primus-zktls-patterns.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/interaction-examples.md`
- `../../references/endpoint-catalog.md`
- `../../references/limitations.md`

## Workflow

1. Confirm the user only needs a read-only market claim.
2. Identify the narrowest endpoint and field set that answers the question.
3. Build one `AttNetworkRequest`.
4. Build `AttNetworkResponseResolve` rules only for the fields the user needs.
5. Generate the attestation with `PrimusCoreTLS`.
6. Verify locally when possible.
7. Return the extracted claim and clearly label it as attested or fallback.

## Default proof patterns

### Single price

Use one request and reveal only:

- token identity
- chain
- price
- timestamp, if available

Recommended endpoint:

- `POST https://web3.okx.com/api/v6/dex/market/price`

Preferred request body:

```json
[
  {
    "chainIndex": "1",
    "tokenContractAddress": "0x0000000000000000000000000000000000000000"
  }
]
```

Example resolve shape:

```ts
const responseResolves = [
  { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].chainIndex" },
  { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenContractAddress" },
  { keyName: "price", parseType: "json", parsePath: "$.data[0].price" },
  { keyName: "time", parseType: "json", parsePath: "$.data[0].time" }
];
```

### K-line / latest OHLC

Prefer proving only the latest bar or a very small fixed window. Reveal:

- open
- high
- low
- close
- time

Avoid proving long candle arrays in the first release.

Recommended endpoint:

- `GET https://web3.okx.com/api/v6/dex/market/candles`

Preferred query pattern:

```text
?chainIndex=501&tokenContractAddress=So11111111111111111111111111111111111111112&bar=1H&limit=1
```

Example resolve shape:

```ts
const responseResolves = [
  { keyName: "ts", parseType: "json", parsePath: "$.data[0][0]" },
  { keyName: "open", parseType: "json", parsePath: "$.data[0][1]" },
  { keyName: "high", parseType: "json", parsePath: "$.data[0][2]" },
  { keyName: "low", parseType: "json", parsePath: "$.data[0][3]" },
  { keyName: "close", parseType: "json", parsePath: "$.data[0][4]" },
  { keyName: "confirm", parseType: "json", parsePath: "$.data[0][7]" }
];
```

### Index price

Treat this like a single derived numeric claim. Reveal:

- index price
- timestamp
- asset identifier

Until the concrete official response example is captured locally, model this after the single-price pattern and only prove:

- asset identifier
- index price
- timestamp

## Attestation rules

- Default to `proxytls`.
- Prefer the documented method, which may be `GET` or a simple JSON `POST`.
- Keep headers minimal and deterministic.
- Use `attConditions` only if the user asks for a bound such as "prove price is above X".
- If the endpoint response is too large, switch to a narrower query before giving up.

## Output contract

For a verifiable reply, structure the result around:

- claim: what upstream fact was requested
- extracted fields: the exact values revealed from the response
- proof status: `attested` or `fallback`
- local verification: `passed`, `failed`, or `not-run`

Never say a result is verified if no attestation was produced.

For broad chart requests, use the `partial` response contract:

- verified subclaim: latest price or latest candle
- unverified remainder: the larger history window

## Fallback rules

Use fallback when:

- the user requests too many candles
- the endpoint is not stable enough for a small proof
- the market request is bundled with wallet-personalized PnL data

When falling back:

1. say the broader query is not yet modeled as a reliable proof
2. offer a smaller verifiable alternative such as:
   - latest price only
   - latest candle only
   - one fixed index snapshot

## Decision tree

1. Is the request a single price, index snapshot, or latest candle?
   - yes -> use an attested flow
2. Is it a small fixed batch of prices?
   - yes -> use a partial or attested flow depending on payload size
3. Is it a long history or wallet-personalized PnL request?
   - no -> fallback or narrow the query

## Examples

### Verifiable price

User intent:

```text
What is the current BTC price on Ethereum? I want a verifiable result.
```

Preferred behavior:

- resolve the target asset
- build a single price request
- prove only `price` and `timestamp`
- report whether local verification succeeded

### Verifiable K-line

User intent:

```text
Show me the latest 1H candle for SOL with a proof.
```

Preferred behavior:

- request the candle endpoint with a fixed interval
- reveal only the most recent bar
- avoid returning a large historical array
