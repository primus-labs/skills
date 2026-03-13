# Response Contracts

Use these reply shapes so all verifiable skills present results consistently.

## User choice policy

For action-oriented endpoints, the user may choose whether to pay the extra cost of proof generation.

When relevant, present a short choice:

- `fast`: plain API result, lowest latency
- `verified`: generate an attestation for the request/response pair
- `verified + chain check`: generate an attestation and also check chain-native finality when applicable

Do not force `fast` or `verified` unless the user has already made their preference clear.

See also:

- `verification-choice-prompts.md`

## 1. Fully attested result

Use when:

- an attestation was generated
- local verification passed

Reply structure:

- `claim`: the exact question answered
- `proof_status`: `attested`
- `verification`: `local verification passed`
- `extracted_fields`: only the attested values actually needed
- `next_step`: optional on-chain verification note if relevant

Example skeleton:

```markdown
Claim: Current token price on Ethereum.
Proof status: attested
Verification: local verification passed
Extracted fields:
- token: 0x...
- price: 123.45
- time: 1716892020000
```

## 2. Attested but not locally verified

Use when:

- the attestation exists
- local verification was intentionally skipped

Reply structure:

- `claim`
- `proof_status`: `attested`
- `verification`: `not run`
- `extracted_fields`
- `note`: say the attestation exists but local verification was not executed yet

## 3. Partial-verifiable result

Use when:

- the user asked a broader question
- only a narrow sub-claim was proven

Reply structure:

- `claim`
- `proof_status`: `partial`
- `verified_subclaim`
- `unverified_remainder`
- `extracted_fields`

Example:

```markdown
Claim: Swap quote plus execution readiness.
Proof status: partial
Verified subclaim: quoted output amount and price impact
Unverified remainder: approval calldata and execution outcome
```

## 4. Fallback result

Use when:

- the request is outside the current proof model
- or the endpoint is too wide, unstable, or execution-heavy

Reply structure:

- `claim`
- `proof_status`: `fallback`
- `reason`
- `best_alternative`

Reasons should be brief and concrete:

- `response too large`
- `endpoint is user-specific`
- `quote is too volatile`
- `chain confirmation is the stronger truth source`
- `feature is whitelisted-only`

## 5. Action-attested result

Use when:

- the endpoint is writable or operation-oriented
- an attestation was generated for the request/response pair

Reply structure:

- `claim`
- `proof_status`: `attested`
- `proof_scope`: `request/response pair`
- `verification`
- `extracted_fields`
- `finality_note`

Example:

```markdown
Claim: Swap quote request and returned route summary.
Proof status: attested
Proof scope: request/response pair
Verification: local verification passed
Extracted fields:
- toTokenAmount: ...
- priceImpactPercent: ...
Finality note: this does not prove the later swap settled on-chain
```

## Output rules

- Never say `verified` unless an attestation exists.
- Never imply a quote proof also proves execution.
- Never imply a broadcast proof is better than chain confirmation.
- For action endpoints, say exactly what was proven:
  - request/response pair
  - execution-prep output
  - or chain finality check
- Prefer short flat lists over dumping raw payloads.
