# Verification Choice Prompts

Use these prompts when the request involves an action-oriented or high-volatility endpoint and the user should choose between speed and proof overhead.

## Default 3-way choice

Use this when all three modes are meaningful:

```text
I can do this in three ways:
1. fast: return the API result with the lowest latency
2. verified response: generate a zkTLS proof for the API request/response pair
3. verified response + chain check: generate the proof and also check chain-native finality where applicable
Which mode do you want?
```

## Default 2-way choice

Use this when there is no meaningful chain-finality add-on:

```text
I can use:
1. fast: lowest latency
2. verified: slower, but I will generate a proof for the API request/response pair
Which do you want?
```

## Swap quote

```text
I can return the quote quickly, or I can also generate a proof for the quote request/response. The proof adds latency and the market may move before execution. Do you want `fast` or `verified quote`?
```

## Approval or swap-prep calldata

```text
I can fetch the approval or swap-prep response directly, or I can prove that exact API request/response pair. That proof does not prove the later transaction was mined. Do you want `fast` or `verified response`?
```

## Broadcast response

```text
I can either broadcast and return the response immediately, or also generate a proof for the broadcast API response. That proof does not replace chain confirmation. Do you want `fast`, `verified response`, or `verified response + chain check`?
```

## Order tracking

```text
I can return the order-status response directly, or prove the exact tracking API response. If your real goal is final settlement, I should also check the tx hash on-chain. Do you want `fast`, `verified response`, or `verified response + chain check`?
```

## Simulation

```text
I can return the simulation result directly, or generate a proof for the simulation API response as well. This proves the request/response pair, not that a later live transaction will behave identically. Do you want `fast` or `verified simulation`?
```

## Gas snapshot

```text
I can return the gas snapshot quickly, or generate a proof for the gas API response. The proof adds latency, so the numbers may already move by the time you act. Do you want `fast` or `verified gas snapshot`?
```

## If the user has no preference

Default behavior:

- for read-only low-volatility data: use verified by default when the skill is verifiable-first
- for action-oriented or fast-moving data: ask before adding proof overhead

## If the user asks for both speed and proof

Offer this compromise:

```text
I can return the fast result first, then generate the proof as a follow-up. That gives you the quickest answer while still producing a verifiable record. Do you want that?
```
