# Binance Verifiable Skills

This package adapts suitable Binance Skills Hub API calls into verifiable HTTPS flows backed by `primus-zktls-core-sdk`.

## What This Package Gives You

- runnable Binance zkTLS demos grouped by `spot`, `margin-trading`, `derivatives-usds-futures`, and `alpha`
- one shared signed-request and attestation helper in [scripts/lib/demo-utils.mjs](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/scripts/lib/demo-utils.mjs)
- one normalized CLI output contract for all demos
- a catalog of modeled endpoints and current live constraints

## Quick Start

1. Install dependencies with `npm install`.
2. Export Primus credentials:
   - `ZKTLS_APP_ID`
   - `ZKTLS_APP_SECRET`
3. Export Binance credentials only for signed demos:
   - `BINANCE_API_KEY`
   - `BINANCE_API_SECRET`
4. Run one demo, for example:

```bash
npm run demo:spot-price -- --symbol BTCUSDT
npm run demo:spot-account-status
npm run demo:futures-api-trading-status
```

5. Run `npm test` for CLI smoke checks.

## Scope

- Keep the public Binance Skills Hub category split:
  - `binance-verifiable-spot`
  - `binance-verifiable-margin-trading`
  - `binance-verifiable-derivatives-usds-futures`
  - `binance-verifiable-alpha`
- Prefer public, read-heavy endpoints for the first release.
- Keep signed private-query support in the shared library, but do not make it the default path.
- Treat action endpoints such as create order, cancel order, borrow, repay, or leverage changes as opt-in proof paths only.

## First Release

The first release is intentionally narrow and stable:

- `spot`: usable first draft
- `margin-trading`: usable first draft for market-data style queries
- `derivatives-usds-futures`: usable first draft
- `alpha`: usable first draft

## Shared Model

All skills in this package use the same proof flow:

1. Identify the narrowest endpoint and the smallest field set needed.
2. Build one `AttNetworkRequest`.
3. Build matching `AttNetworkResponseResolve` rules.
4. Generate request params with `PrimusCoreTLS.generateRequestParams()`.
5. Call `startAttestation()`.
6. Optionally call local `verifyAttestation()`.
7. Return the extracted fields and clearly state what was and was not proven.

See:

- `references/primus-zktls-patterns.md`
- `references/endpoint-catalog.md`
- `references/response-contracts.md`
- `references/fallback-decision-trees.md`
- `references/limitations.md`
- `demos.md`

## Included Demos

This package ships with the current verified and draft demo set:

- `demo:spot-price`
- `demo:spot-klines`
- `demo:spot-book-ticker`
- `demo:spot-avg-price`
- `demo:spot-depth`
- `demo:spot-account`
- `demo:spot-account-status`
- `demo:spot-account-info`
- `demo:spot-asset-balance`
- `demo:spot-trade-fee`
- `demo:spot-api-restrictions`
- `demo:spot-api-trading-status`
- `demo:spot-capital-config`
- `demo:spot-bnb-burn`
- `demo:spot-order-status`
- `demo:futures-premium-index`
- `demo:futures-funding-rate`
- `demo:futures-open-interest`
- `demo:futures-position-risk`
- `demo:futures-balance`
- `demo:futures-account`
- `demo:futures-api-trading-status`
- `demo:futures-commission-rate`
- `demo:margin-all-pairs`
- `demo:margin-account`
- `demo:margin-max-borrowable`
- `demo:margin-max-transferable`
- `demo:alpha-token-search`

Representative commands:

```bash
npm run demo:spot-price -- --symbol BTCUSDT
npm run demo:spot-account -- --omit-zero-balances true
npm run demo:spot-account-status
npm run demo:spot-account-info
npm run demo:spot-api-trading-status
npm run demo:futures-premium-index -- --symbol BTCUSDT
npm run demo:futures-account
npm run demo:futures-api-trading-status
npm run demo:margin-account
npm run demo:alpha-token-search -- --keyword USDT --chain-ids 56
```

For the full command matrix, see [demos.md](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/demos.md).

## Standard Output

Every demo prints:

- a direct Binance response summary when `--skip-direct-fetch` is not used
- a normalized `Attestation summary` object with:
  - `claim`
  - `endpoint`
  - `proofType`
  - `proofStatus`
  - `localVerification`
  - `extractedFields`
  - `verifiesWhat`
  - `doesNotVerify`
  - `attestation`

The exact contract is documented in [response-contracts.md](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/references/response-contracts.md).

## Repository Layout

- [scripts/](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/scripts): runnable demo entrypoints
- [scripts/lib/demo-utils.mjs](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/scripts/lib/demo-utils.mjs): shared Binance request and attestation helpers
- [demos.md](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/demos.md): runnable demo catalog
- [references/endpoint-catalog.md](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/references/endpoint-catalog.md): modeled endpoint list
- [references/response-contracts.md](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/references/response-contracts.md): output contract
- [skills/](/Users/xiexiang/Documents/Codes/skills/binance-verifiable-skills/skills): per-domain skill guidance

## Design Principles

- Verifiable first, but not verifiable only.
- Do not overprove large Binance payloads.
- Prefer one proof per user-visible claim.
- Separate request-response proof from exchange execution semantics.
- Explicitly mark results as `attested`, `partial`, or `fallback`.

## Current Live Notes

- `demo:spot-bnb-burn` has completed live attestation with `localVerification: true`.
- `demo:spot-api-trading-status` has completed live attestation with `localVerification: true`.
- `demo:spot-account-status` has completed live attestation with `localVerification: true`.
- `demo:spot-account-info` has completed live attestation with `localVerification: true`.
- `demo:futures-api-trading-status` has completed live attestation with `localVerification: true`.
- `demo:spot-capital-config` is implemented and direct fetch works, but the current full-response proof path timed out during live attestation against `/sapi/v1/capital/config/getall`.
- Large signed array endpoints should be treated as best-effort until a narrower server-side query path is available.
