# OnchainOS Verifiable Skills

This package mirrors the public `onchainos-skills` categories and adapts suitable OnchainOS API calls into verifiable flows built on `primus-zktls-core-sdk`. Read-heavy endpoints are usually the best default proof targets, while action-oriented endpoints can also be attested when the user wants the extra assurance.

## Scope

- Keep the original OKX OnchainOS category split:
  - `okx-verifiable-dex-market`
  - `okx-verifiable-dex-token`
  - `okx-verifiable-wallet-portfolio`
  - `okx-verifiable-dex-swap`
  - `okx-verifiable-onchain-gateway`
- Prefer verifiable HTTPS data retrieval for read-heavy calls.
- Allow proof on action-oriented endpoints as an opt-in mode when the user accepts extra latency or freshness tradeoffs.
- Fall back or narrow the query only when the payload is too unstable, too large, too sensitive, or better validated directly on-chain.

## First Release

The first release is intentionally uneven:

- `okx-verifiable-dex-market`: usable first draft
- `okx-verifiable-dex-token`: usable first draft
- `okx-verifiable-wallet-portfolio`: planned, partial
- `okx-verifiable-dex-swap`: planned, quote-first
- `okx-verifiable-onchain-gateway`: planned, simulate-first

## Shared Model

All skills in this package assume the same proof flow:

1. Identify a stable REST endpoint and the minimum response fields needed.
2. Build an `AttNetworkRequest`.
3. Build matching `AttNetworkResponseResolve` rules.
4. Generate request params with `PrimusCoreTLS.generateRequestParams()`.
5. Call `startAttestation()`.
6. Optionally call local `verifyAttestation()`.
7. If required, pass the returned `Attestation` to a contract using `IPrimusZKTLS.verifyAttestation(attestation)`.

See:

- `references/primus-zktls-patterns.md`
- `references/primus-request-examples.md`
- `references/endpoint-catalog.md`
- `references/response-contracts.md`
- `references/fallback-decision-trees.md`
- `references/verification-choice-prompts.md`
- `references/interaction-examples.md`
- `references/limitations.md`
- `demos.md`

## Design Principles

- Verifiable first, but not verifiable only.
- Preserve the original user intent routing from `onchainos-skills`.
- Prefer public, read-only, JSON-shaped responses as the default proof path.
- Treat action-oriented endpoints as user-choice proof paths rather than banned proof targets.
- Be explicit when a result is:
  - fully verifiable
  - partially verifiable
  - fallback only

## Minimal Demo

Use `demos.md` as the single catalog for all runnable demos, including category mapping, default commands, attested fields, and notes about dynamic endpoints.

This package now includes runnable demos for ten OKX read-heavy or narrowly scoped endpoints backed by Primus zkTLS:

- `market price`
- `token search`
- `token basic info`
- `wallet token balance`
- `wallet total value`
- `gas price`
- `gateway supported chains`
- `swap supported chains`
- `swap liquidity`
- `swap quote`

Files:

- `scripts/demo-okx-market-price.mjs`
- `scripts/demo-okx-token-search.mjs`
- `scripts/demo-okx-token-basic-info.mjs`
- `scripts/demo-okx-wallet-token-balance.mjs`
- `scripts/demo-okx-wallet-total-value.mjs`
- `scripts/demo-okx-gas-price.mjs`
- `scripts/demo-okx-gateway-supported-chains.mjs`
- `scripts/demo-okx-swap-supported-chains.mjs`
- `scripts/demo-okx-swap-liquidity.mjs`
- `scripts/demo-okx-swap-quote.mjs`
- `.env.example`

Setup:

1. Copy `.env.example` values into your shell environment.
2. Get OKX API credentials:
   - Create or sign in to the [OKX Developer Portal](https://web3.okx.com/build/dev-portal).
   - Follow the [Developer Dashboard guide](https://web3.okx.com/onchainos/dev-docs/home/developer-portal) to create a project and generate an API key.
   - Collect:
     - `OKX_API_KEY`
     - `OKX_SECRET_KEY`
     - `OKX_PASSPHRASE`
3. Get Primus zkTLS credentials:
   - Create a project in the [Primus Developer Hub](https://dev.primuslabs.xyz/).
   - If you need setup background, see:
     - [Primus zkTLS Overview](https://docs.primuslabs.xyz/data-verification/zk-tls-sdk/overview/)
     - [Primus zkTLS Install Guide](https://docs.primuslabs.xyz/data-verification/zk-tls-sdk/install/)
   - Collect:
     - `ZKTLS_APP_ID`
     - `ZKTLS_APP_SECRET`
4. Export these environment variables:
   - `OKX_API_KEY`
   - `OKX_SECRET_KEY`
   - `OKX_PASSPHRASE`
   - `ZKTLS_APP_ID`
   - `ZKTLS_APP_SECRET`
5. Run:

```bash
npm run demo:market-price -- --chain-index 1 --token-address 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
npm run demo:token-search -- --chains 501 --query BONK
npm run demo:token-basic-info -- --chain-index 501 --token-address So11111111111111111111111111111111111111112
npm run demo:wallet-token-balance -- --address 0x28C6c06298d514Db089934071355E5743bf21d60 --chain-index 1 --token-address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
npm run demo:wallet-total-value -- --address 0x28C6c06298d514Db089934071355E5743bf21d60 --chains 1 --asset-type 0
npm run demo:gas-price -- --chain-index 1
npm run demo:gateway-supported-chains
npm run demo:swap-supported-chains
npm run demo:swap-liquidity -- --chain-index 1
npm run demo:swap-quote -- --chain-index 1 --amount 100000000 --swap-mode exactIn --from-token-address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 --to-token-address 0xdac17f958d2ee523a2206206994597c13d831ec7
```

Optional flags:

- `--timeout-ms <ms>`
- `--skip-direct-fetch`

Token-search-specific flags:

- `--chains <ids>`
- `--query <keyword>`

Token-basic-info-specific flags:

- `--chain-index <id>`
- `--token-address <addr>`

Wallet-token-balance-specific flags:

- `--address <wallet>`
- `--chain-index <id>`
- `--token-address <addr>`

Wallet-total-value-specific flags:

- `--address <wallet>`
- `--chains <ids>`
- `--asset-type <type>`

Gas-price-specific flags:

- `--chain-index <id>`

Swap-liquidity-specific flags:

- `--chain-index <id>`

Swap-quote-specific flags:

- `--chain-index <id>`
- `--amount <raw>`
- `--swap-mode <mode>`
- `--from-token-address <addr>`
- `--to-token-address <addr>`

What the demo does:

1. Signs a direct OKX `POST /api/v6/dex/market/price` request.
2. Optionally fetches the plain API response for comparison.
3. Builds a Primus `AttNetworkRequest`.
4. Generates an attestation for the response fields:
   - `chainIndex`
   - `tokenContractAddress`
   - `time`
   - `price`
5. Runs local verification and prints a compact summary.

The token search demo follows the same flow for `GET /api/v6/dex/market/token/search`, and attests:

- `chainIndex`
- `tokenContractAddress`
- `tokenSymbol`
- `tokenName`
- `tagList.communityRecognized`

The token basic info demo follows the same flow for `POST /api/v6/dex/market/token/basic-info`, and attests:

- `chainIndex`
- `tokenContractAddress`
- `tokenName`
- `tokenSymbol`
- `decimal`
- `tagList.communityRecognized`

The wallet token balance demo follows the same flow for `POST /api/v6/dex/balance/token-balances-by-address`, and attests:

- `chainIndex`
- `tokenContractAddress`
- `symbol`
- `balance`
- `tokenPrice`
- `isRiskToken`

The wallet total value demo follows the same flow for `GET /api/v6/dex/balance/total-value-by-address`, and attests:

- `totalValue`

The gas price demo follows the same flow for `GET /api/v6/dex/pre-transaction/gas-price`, and attests:

- `normal`
- `min`
- `max`
- `supportEip1559`
- `eip1559Protocol.suggestBaseFee`
- `eip1559Protocol.proposePriorityFee`

The gateway supported chains demo follows the same flow for `GET /api/v6/dex/pre-transaction/supported/chain`, and attests:

- `chainIndex`
- `name`
- `shortName`

The swap supported chains demo follows the same flow for `GET /api/v6/dex/aggregator/supported/chain`, and attests:

- `chainIndex`
- `chainName`
- `dexTokenApproveAddress`

The swap liquidity demo follows the same flow for `GET /api/v6/dex/aggregator/get-liquidity`, and attests:

- `id`
- `name`
- `logo`

The swap quote demo follows the same flow for `GET /api/v6/dex/aggregator/quote`, and attests:

- `chainIndex`
- `fromTokenAmount`
- `toTokenAmount`
- `tradeFee`
- `estimateGasFee`
- `toToken.tokenContractAddress`
- `toToken.tokenSymbol`
- `priceImpactPercent`
