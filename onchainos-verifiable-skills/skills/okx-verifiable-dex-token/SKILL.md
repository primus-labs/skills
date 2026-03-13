---
name: okx-verifiable-dex-token
description: Generate verifiable token-data calls for OKX OnchainOS-style workflows using Primus zkTLS. Use when the user asks for token discovery, token metadata, price info, hot token rankings, liquidity summaries, or token safety snapshots and wants the returned fields backed by an attestation. Prefer this skill for read-only token endpoints with stable JSON responses.
---

# OKX Verifiable DEX Token

Use this skill together with `primus-zktls-core-sdk` when the user wants token-level data with a proof.

## Scope

Prefer this skill for:

- token search for a concrete query
- token metadata and price info
- hot token rankings
- top liquidity summary for a token
- narrow safety or advanced-info claims

Do not force this skill for:

- full holder lists
- full trader lists
- long trade histories
- highly dynamic scanning queries

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/interaction-examples.md`
- `../../references/endpoint-catalog.md`
- `../../references/limitations.md`

## Workflow

1. Reduce the request to one concrete token question.
2. Choose the narrowest read-only endpoint that answers it.
3. Reveal only the fields needed for the user-visible claim.
4. Generate and verify an attestation when the response shape is stable.
5. If the request is too broad, offer a narrower verifiable sub-query.

## Default proof patterns

### Token search

Good when the user asks a concrete lookup such as one symbol, one chain, or one token name.

Recommended endpoint:

- `GET https://web3.okx.com/api/v6/dex/market/token/search`

Preferred query pattern:

```text
?chains=501&search=BONK
```

Reveal only:

- token contract address
- chain
- symbol
- name
- ranking or match score, if needed

Avoid revealing large search result arrays when one best match is enough.

Example resolve shape:

```ts
const responseResolves = [
  { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].chainIndex" },
  { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenContractAddress" },
  { keyName: "symbol", parseType: "json", parsePath: "$.data[0].tokenSymbol" },
  { keyName: "name", parseType: "json", parsePath: "$.data[0].tokenName" },
  { keyName: "communityRecognized", parseType: "json", parsePath: "$.data[0].tagList.communityRecognized" }
];
```

### Token price info

Good for:

- current price
- market cap
- liquidity
- 24h change

Reveal the exact field set requested by the user, not the entire object.

Recommended endpoint:

- `POST https://web3.okx.com/api/v6/dex/market/price-info`

Preferred request body:

```json
[
  {
    "chainIndex": "501",
    "tokenContractAddress": "So11111111111111111111111111111111111111112"
  }
]
```

Example resolve shape:

```ts
const responseResolves = [
  { keyName: "price", parseType: "json", parsePath: "$.data[0].price" },
  { keyName: "time", parseType: "json", parsePath: "$.data[0].time" },
  { keyName: "marketCap", parseType: "json", parsePath: "$.data[0].marketCap" },
  { keyName: "liquidity", parseType: "json", parsePath: "$.data[0].liquidity" },
  { keyName: "priceChange24H", parseType: "json", parsePath: "$.data[0].priceChange24H" }
];
```

### Hot tokens / rankings

Good when the query is fixed, for example:

- one chain
- one ranking type
- top N with small N

Reveal only the top rows and only the fields the user asked about.

Recommended endpoint:

- `GET https://web3.okx.com/api/v6/dex/market/token/hot-token`

Preferred query pattern:

```text
?rankingType=4&chainIndex=501&rankingTimeFrame=2
```

First-release rule:

- prove only the first row unless the user explicitly needs a very small top-N list
- reveal only token identity plus the ranking fields needed for the answer

Example resolve shape:

```ts
const responseResolves = [
  { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenContractAddress" },
  { keyName: "symbol", parseType: "json", parsePath: "$.data[0].tokenSymbol" },
  { keyName: "price", parseType: "json", parsePath: "$.data[0].price" },
  { keyName: "marketCap", parseType: "json", parsePath: "$.data[0].marketCap" },
  { keyName: "riskLevelControl", parseType: "json", parsePath: "$.data[0].riskLevelControl" }
];
```

### Advanced token info

Possible for narrow risk claims such as:

- honeypot tag
- creator address
- top10 concentration
- dev holding percent

Avoid large nested payloads in the first release.

Until the official advanced-info payload is modeled into a stable proof template here, only use this path for very small, explicit claims.

## Attestation rules

- Prefer the documented method with stable parameters, whether that is `GET` or a narrow JSON `POST`.
- Use one proof per question unless the endpoint naturally returns a tiny fixed list.
- If the user asks "is this token safe", prove the smallest meaningful subset:
  - honeypot tag
  - top holder concentration
  - creator or deployer identity
- If the user asks for discovery plus analysis, split it into separate proofs when needed.

## Output contract

For a verifiable reply, present:

- query: what token question was asked
- extracted fields: the exact attested values
- proof status: `attested` or `fallback`
- verification: local result if run

For broader token research prompts, prefer the `partial` contract:

- verified subclaim: token identity, one risk field bundle, or top row
- unverified remainder: long rankings, holder lists, or trade activity

## Fallback rules

Use fallback when:

- the user wants long holder or trader lists
- the endpoint response is too wide or highly dynamic
- the request is more like "scan the whole market"

Offer smaller verifiable alternatives such as:

- best token match only
- one risk field bundle
- top 5 ranked tokens instead of a long ranking

## Decision tree

1. Is the request a concrete token lookup, token price-info query, or top-row ranking question?
   - yes -> use an attested flow
2. Is it a small ranking request such as top 5?
   - yes -> consider `partial` and keep the proof payload small
3. Is it a full holder list, full trader list, or open-ended scan?
   - no -> fallback or narrow to one token and one metric bundle

## Examples

### Verifiable token search

User intent:

```text
Find the BONK token on Solana and prove the contract address you used.
```

Preferred behavior:

- run a narrow search query
- reveal contract address, symbol, and chain
- label the result as attested if proof generation succeeds

### Verifiable safety snapshot

User intent:

```text
Can you prove whether this token is tagged as a honeypot?
```

Preferred behavior:

- query the narrow advanced-info endpoint
- reveal only the safety tag plus token identity
- avoid dumping the entire advanced-info payload
