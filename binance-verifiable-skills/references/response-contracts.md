# Response Contracts

Use these output contracts whenever a Binance verifiable flow is selected.

## Standard CLI Output

All demo scripts now emit a normalized proof object in the `Attestation summary` block. The top-level shape is:

- `claim`
- `endpoint`
- `proofType`
- `proofStatus`
- `localVerification`
- `extractedFields`
- `verifiesWhat`
- `doesNotVerify`
- `attestation`

The nested `attestation` object contains the transport-level details:

- `recipient`
- `request`
- `attestors`
- `signatures`
- `timestamp`
- `attestedData`

## Verifiable

Use when the whole user-visible answer is covered by a compact attested field set.

- `claim`
- `endpoint`
- `proofType`
- `extractedFields`
- `proofStatus`
- `localVerification`
- `verifiesWhat`
- `doesNotVerify`

## Partial

Use when only a narrow subclaim is attested.

- `claim`
- `endpoint`
- `proofType`
- `verifiedSubclaim`
- `unverifiedRemainder`
- `extractedFields`
- `proofStatus`
- `localVerification`

## Fallback

Use when no attestation was generated.

- `claim`
- `endpoint`
- `proofType`
- `reason`
- `fallbackData`
- `proofStatus`

## Required wording

For Binance action-oriented APIs, always separate:

- what Binance returned
- what fields were attested
- what the proof does not establish about execution, fill status, or settlement
