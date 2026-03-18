---
name: binance-verifiable-alpha
description: Generate verifiable Binance Alpha and Binance Web3 API calls using Primus zkTLS. Use when the user asks for token discovery, token list snapshots, or narrow read-only Binance Alpha claims that should be backed by an attestation.
---

# Binance Verifiable Alpha

Use this skill together with `primus-zktls-core-sdk` when the user wants Binance Alpha or Binance Web3 read-only data with a proof.

## Scope

Prefer this skill for:

- token list pages
- narrow token discovery queries
- one-row alpha token snapshots

Do not force this skill for:

- broad multi-page scans
- large ranking windows
- action or wallet flows outside the public alpha endpoints

## Shared references

- `../../references/primus-zktls-patterns.md`
- `../../references/endpoint-catalog.md`
- `../../references/response-contracts.md`
- `../../references/fallback-decision-trees.md`
- `../../references/limitations.md`

## First release

Recommended endpoint:

- `GET https://web3.binance.com/bapi/defi/v5/public/wallet-direct/buw/wallet/market/token/search`

Use a narrow keyword query and prove only the top match.

Reveal only:

- `code`
- `success`
- `symbol`
- `name`
- `price`
- `marketCap`

For token metadata and dynamic-info lookups, treat them as planned follow-ups until the exact public endpoint shape is reconfirmed.

## Guidance

- Alpha endpoints can evolve faster than core Spot or Futures docs, so keep proof fields minimal.
- Prefer single-page, top-row claims over broad exploration prompts.
- If the user wants full market scanning, fall back or offer a narrower verified subclaim.
