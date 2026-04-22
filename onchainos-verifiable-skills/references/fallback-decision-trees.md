# Fallback Decision Trees

Use these decision trees before answering with any verifiable skill.

See also:

- `verification-choice-prompts.md`

## Global tree

1. Is the user asking for a read-only claim or an action-oriented endpoint?
2. Does the user want:
   - fastest result
   - verified request/response
   - verified request/response plus finality checks where possible
3. Can one stable REST endpoint answer the request?
4. Can the answer be reduced to a small fixed field set?
5. Can those fields be extracted with stable JSON paths?

If 3-5 are yes:

- use a verifiable flow

If the endpoint is action-oriented:

- warn about latency, freshness, and possible drift between proof time and execution time
- still allow proof generation if the user chooses it
- state clearly that proving a request/response pair is not the same as proving final on-chain settlement

If 3-5 fail:

- offer a narrower verifiable sub-query

If the user prefers speed over proof:

- use the normal flow and mention that a verifiable mode is available

## Market

1. Price or one latest candle?
   - yes -> attested
2. Long historical chart or wallet PnL history?
   - no -> fallback or narrower proof

## Token

1. Concrete token lookup, price info, or top-ranked token row?
   - yes -> attested
2. Full holder list, trader list, or market-wide scan?
   - no -> fallback or reduce to top row / one risk bundle

## Wallet portfolio

1. Supported chains?
   - yes -> attested
2. One token balance or total value?
   - maybe -> partial
3. Full wallet inventory across many chains?
   - no -> fallback

## Swap

1. Liquidity-source metadata?
   - yes -> attested
2. Quote summary?
   - maybe -> partial or action-attested, depending on user choice
3. Approval or swap calldata generation?
   - yes -> action-attested if the user explicitly wants proof, otherwise fast path
4. Execution outcome?
   - use chain-native confirmation as the stronger source of truth

## Gateway

1. Supported chains?
   - yes -> attested
2. Gas snapshot or gas limit?
   - maybe -> partial
3. Simulation result?
   - maybe -> partial or action-attested, but mention whitelist risk
4. Broadcast or order tracking?
   - allow proof of request/response if the user wants it, but always pair it with a finality note

## Narrowing guidance

If you must narrow the question, prefer these replacements:

- many candles -> latest candle
- long ranking -> top row or top 5
- full wallet -> one token balance or total value
- swap execution -> quote summary
- tx confirmation -> tx hash plus chain confirmation

## Prompting guidance

For action-oriented requests, ask a short preference question when needed:

- `Use the fast path or generate a verifiable proof as well?`
- `Do you want proof of the API response, chain finality confirmation, or both?`
