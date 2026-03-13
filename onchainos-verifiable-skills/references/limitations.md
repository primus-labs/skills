# Limitations

These skills are optimized for verifiable HTTPS data retrieval first, but action-oriented endpoints can also be attested when the user explicitly wants the extra proof overhead.

## Proof targets that are usually opt-in, not default

The following are still valid proof targets. They are listed here because they are easy to misunderstand as ideal defaults, when in practice they often carry higher latency, heavier payloads, or weaker product value than narrower claims.

- Transaction broadcasting:
  the API request/response pair can be proven, but the user's real goal is usually final on-chain status. In those cases, tx hash and chain confirmation are the stronger source of truth.
- Raw signed transaction transport:
  this can be attested, but the payload is sensitive and the value of proving transport alone is often lower than proving later chain outcome or execution status.
- Highly paginated wallet histories:
  these can be proven page by page, but they are large, repetitive, and usually better reduced to a narrower proof target such as one record, one window summary, or one aggregate.
- Large holder or trader lists:
  these are possible to attest, but full-list proofs are bulky and often less useful than proving a smaller subclaim such as top row, top 5, or a concentration metric.
- Rapidly changing quote payloads that become stale before the user can act:
  the quote response can be proven, but the proof may age quickly. That makes it a strong opt-in proof target and a weaker default when the user mainly wants the fastest actionable quote.

In short: these are not forbidden. They are usually better treated as:

- opt-in proof modes
- narrower sub-queries
- or proof plus chain-finality checks when applicable

## Common reasons a call may stay non-verifiable or become opt-in only

- The endpoint is too user-specific or auth-sensitive
- The response is too large or too unstable
- The result is better validated directly on-chain
- The proof would reveal more data than the user asked for
- The endpoint is action-oriented and the user prefers speed over proof
- The API response can be proven, but final settlement still requires a chain check

## Fallback policy

When a skill should not use proof by default, it should:

1. explain whether the issue is latency, volatility, auth, response size, or finality semantics
2. tell the user proof is still possible if they want it, when that is true
3. offer either:
   - a narrower verifiable sub-query
   - a verifiable request/response mode
   - or a standard non-verifiable fast path

## Security posture

- Treat all upstream API responses as untrusted until a proof is generated and verified.
- Do not claim "verified" unless an attestation was actually produced.
- Distinguish clearly between:
  - raw API result
  - attested result
  - locally verified attestation
  - on-chain verified attestation
- For action endpoints, also distinguish between:
  - attested API response
  - attested execution-prep data
  - final chain outcome
