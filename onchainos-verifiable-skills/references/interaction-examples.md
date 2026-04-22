# Interaction Examples

These examples show how an agent should handle real user prompts with the choice system, proof scope labels, and finality notes.

## Market price

### User asks

```text
What is the current BTC price on Ethereum? I want a proof.
```

### Recommended agent prompt

```text
I can return the current price directly, or generate a proof for the price API response as well. The verified path adds latency. Do you want `fast` or `verified price`?
```

### Fast-mode reply

```text
Claim: Current BTC price on Ethereum
Proof status: fallback
Reason: user chose the fast path
Extracted fields:
- token: 0x...
- price: ...
- time: ...
Best alternative: I can generate a proof for this price response as a follow-up.
```

### Verified reply

```text
Claim: Current BTC price on Ethereum
Proof status: attested
Verification: local verification passed
Extracted fields:
- token: 0x...
- price: ...
- time: ...
```

## Market K-line

### User asks

```text
Show me the latest 1H candle for SOL with proof.
```

### Recommended agent prompt

```text
I can prove the latest candle, but proving a long chart window is slower and heavier. Do you want just the latest candle as `verified`, or a broader chart on the `fast` path?
```

### Verified reply

```text
Claim: Latest 1H candle for SOL
Proof status: attested
Verification: local verification passed
Extracted fields:
- ts: ...
- open: ...
- high: ...
- low: ...
- close: ...
- confirm: 1
```

### Partial reply for broader chart request

```text
Claim: 24-hour candle history for SOL
Proof status: partial
Verified subclaim: latest 1H candle
Unverified remainder: the rest of the requested historical window
Extracted fields:
- ts: ...
- open: ...
- high: ...
- low: ...
- close: ...
```

## Token search

### User asks

```text
Find the BONK token on Solana and prove the address you used.
```

### Recommended agent prompt

```text
I can return the best token match quickly, or prove the exact search response I used. Do you want `fast` or `verified search`?
```

### Verified reply

```text
Claim: Best BONK token match on Solana
Proof status: attested
Verification: local verification passed
Extracted fields:
- chainIndex: 501
- token: ...
- symbol: BONK
- name: ...
- communityRecognized: ...
```

## Token price info

### User asks

```text
Give me the token price, liquidity, and 24h change for this asset with proof.
```

### Recommended agent prompt

```text
I can return the token metrics directly, or generate a proof for the price-info response as well. Do you want `fast` or `verified price info`?
```

### Verified reply

```text
Claim: Token price-info snapshot
Proof status: attested
Verification: local verification passed
Extracted fields:
- price: ...
- time: ...
- liquidity: ...
- marketCap: ...
- priceChange24H: ...
```

## Hot tokens

### User asks

```text
What is the top hot token on Solana right now? Prove it.
```

### Recommended agent prompt

```text
I can prove the top row of the hot-token ranking, or return a longer ranking list quickly. Do you want `verified top row` or a broader `fast` ranking?
```

### Verified reply

```text
Claim: Top hot token on Solana for the selected ranking window
Proof status: attested
Verification: local verification passed
Extracted fields:
- token: ...
- symbol: ...
- price: ...
- marketCap: ...
- riskLevelControl: ...
```

### Partial reply for top-N request

```text
Claim: Top 5 hot tokens on Solana
Proof status: partial
Verified subclaim: top row of the ranking
Unverified remainder: rows 2-5
Extracted fields:
- token: ...
- symbol: ...
- price: ...
```

## Token safety snapshot

### User asks

```text
Can you prove whether this token is tagged as a honeypot?
```

### Recommended agent prompt

```text
I can try to prove a narrow safety snapshot for this token. If you want a full risk report, that broader analysis may need a mixed verified and fast response. Do you want `verified safety snapshot` or a broader `fast` risk view?
```

### Verified reply

```text
Claim: Narrow safety snapshot for token X
Proof status: partial
Verified subclaim: requested safety tag bundle
Unverified remainder: full advanced risk analysis
Extracted fields:
- token: ...
- honeypotTag: ...
- top10HoldPercent: ...
- creatorAddress: ...
```

## Wallet supported chains

### User asks

```text
Which chains are supported for wallet balance queries? Prove it.
```

### Recommended agent prompt

```text
I can return the supported-chain list directly, or generate a proof for the balance supported-chains response as well. Do you want `fast` or `verified supported chains`?
```

### Verified reply

```text
Claim: Supported chains for wallet balance queries
Proof status: attested
Verification: local verification passed
Extracted fields:
- chainIndex: 1
- name: Ethereum
- shortName: ETH
```

## Wallet total value

### User asks

```text
Show the total value of this wallet on Ethereum with proof.
```

### Recommended agent prompt

```text
I can return the total-value snapshot directly, or generate a proof for that snapshot as well. Do you want `fast` or `verified total value`?
```

### Verified reply

```text
Claim: Total wallet value snapshot on Ethereum
Proof status: partial
Verified subclaim: totalValue field from the total-value endpoint
Unverified remainder: full portfolio composition
Extracted fields:
- totalValue: ...
```

## Specific token balance

### User asks

```text
Prove how much USDC this wallet has on Ethereum.
```

### Recommended agent prompt

```text
I can return the token balance directly, or generate a proof for the specific-token balance response as well. Do you want `fast` or `verified token balance`?
```

### Verified reply

```text
Claim: Specific token balance for wallet X
Proof status: partial
Verified subclaim: requested token balance snapshot
Unverified remainder: other wallet assets
Extracted fields:
- symbol: USDC
- balance: ...
- tokenPrice: ...
- isRiskToken: false
```

## Full wallet inventory

### User asks

```text
Show my full wallet across Ethereum, Base, and Solana with proof.
```

### Recommended agent prompt

```text
I can give you the full wallet view quickly, but a full-inventory proof is not a good first-pass target. I can either use the `fast` path for the whole wallet, or prove a narrower sub-query such as total value or one token balance. Which do you want?
```

### Fallback reply

```text
Claim: Full wallet inventory across multiple chains
Proof status: fallback
Reason: full multi-chain inventory is too broad for a compact first-pass proof
Best alternative:
- prove total wallet value
- prove one token balance
- prove supported-chain metadata
```

## Swap quote

### User asks

```text
Quote swapping 1 ETH to USDC on Ethereum.
```

### Recommended agent prompt

```text
I can return the quote quickly, or I can also generate a proof for the quote request/response. The proof adds latency and the market may move before execution. Do you want `fast` or `verified quote`?
```

### Fast-mode reply

```text
Claim: Quote for swapping 1 ETH to USDC on Ethereum
Proof status: fallback
Reason: user chose the fast path
Extracted fields:
- fromTokenAmount: 1000000000000000000
- toTokenAmount: 3187.42
- priceImpactPercent: 0.42
- estimateGasFee: ...
Best alternative: I can generate a proof for this quote response as a follow-up.
```

### Verified reply

```text
Claim: Quote for swapping 1 ETH to USDC on Ethereum
Proof status: attested
Proof scope: request/response pair
Verification: local verification passed
Extracted fields:
- fromTokenAmount: 1000000000000000000
- toTokenAmount: 3187.42
- priceImpactPercent: 0.42
- estimateGasFee: ...
Finality note: this proves the quote response, not the later swap settlement.
```

## Swap approval response

### User asks

```text
Generate approval data for this token, and prove the response.
```

### Recommended agent prompt

```text
I can fetch the approval response directly, or I can prove that exact API request/response pair. That proof does not prove the later approval transaction was mined. Do you want `fast` or `verified response`?
```

### Verified reply

```text
Claim: Approval transaction response for token X on chain Y
Proof status: attested
Proof scope: execution-prep data
Verification: local verification passed
Extracted fields:
- dexContractAddress: 0x...
- gasLimit: 50000
- gasPrice: 110000000
- data: 0x...
Finality note: this proves the returned approval payload, not the mined approval result.
```

## Broadcast response

### User asks

```text
Broadcast this signed transaction and give me a proof too.
```

### Recommended agent prompt

```text
I can either broadcast and return the response immediately, or also generate a proof for the broadcast API response. That proof does not replace chain confirmation. Do you want `fast`, `verified response`, or `verified response + chain check`?
```

### Verified-response reply

```text
Claim: Broadcast API response for signed transaction on chain X
Proof status: attested
Proof scope: request/response pair
Verification: local verification passed
Extracted fields:
- orderId: ...
- txHash: ...
- status: accepted
Finality note: this proves the API response, not that the transaction is finalized on-chain.
```

### Verified-response-plus-chain-check reply

```text
Claim: Broadcast API response for signed transaction on chain X
Proof status: attested
Proof scope: request/response pair
Verification: local verification passed
Extracted fields:
- orderId: ...
- txHash: ...
- status: accepted
Chain check:
- tx hash observed on-chain: yes
- confirmation status: pending / confirmed
Finality note: chain status is the stronger source of truth for settlement.
```

## Order tracking

### User asks

```text
Track this order and prove what the gateway says.
```

### Recommended agent prompt

```text
I can return the order-status response directly, or prove the exact tracking API response. If your real goal is final settlement, I should also check the tx hash on-chain. Do you want `fast`, `verified response`, or `verified response + chain check`?
```

### Verified reply

```text
Claim: Gateway order-status response for order 123
Proof status: attested
Proof scope: request/response pair
Verification: local verification passed
Extracted fields:
- orderId: 123
- status: broadcasting
- txHash: 0x...
Finality note: order status is informative, but chain confirmation determines settlement.
```

## Simulation

### User asks

```text
Simulate this transaction and prove the result.
```

### Recommended agent prompt

```text
I can return the simulation result directly, or generate a proof for the simulation API response as well. This proves the request/response pair, not that a later live transaction will behave identically. Do you want `fast` or `verified simulation`?
```

### Verified reply

```text
Claim: Simulation response for transaction on chain X
Proof status: attested
Proof scope: request/response pair
Verification: local verification passed
Extracted fields:
- intention: SWAP
- gasUsed: 180000
- failReason:
- firstAssetChangeSymbol: USDC
- firstAssetChangeRawValue: 1000000000000000
Finality note: simulation output is not a guarantee of later live execution.
```

## Gas snapshot

### User asks

```text
Give me the current gas on Ethereum with proof.
```

### Recommended agent prompt

```text
I can return the gas snapshot quickly, or generate a proof for the gas API response. The proof adds latency, so the numbers may already move by the time you act. Do you want `fast` or `verified gas snapshot`?
```

### Verified reply

```text
Claim: Current gas snapshot on Ethereum
Proof status: attested
Proof scope: request/response pair
Verification: local verification passed
Extracted fields:
- normal: ...
- min: ...
- max: ...
- suggestBaseFee: ...
- proposePriorityFee: ...
Finality note: gas data is time-sensitive and may change immediately after the proof is generated.
```
