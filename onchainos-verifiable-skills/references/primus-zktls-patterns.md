# Primus zkTLS Patterns

This package uses `primus-zktls-core-sdk` as the proof layer for suitable OnchainOS HTTPS calls.

## Baseline flow

1. Initialize once:

```ts
import { PrimusCoreTLS } from "@primuslabs/zktls-core-sdk";

const zkTLS = new PrimusCoreTLS();
await zkTLS.init(appId, appSecret, "auto");
```

2. Build a request:

```ts
const request = {
  url: "https://example.com/path?x=1",
  method: "GET",
  header: {
    accept: "application/json"
  },
  body: ""
};
```

3. Build response extraction rules:

```ts
const responseResolves = [
  {
    keyName: "price",
    parseType: "json",
    parsePath: "$.data.price"
  }
];
```

4. Generate params and start attestation:

```ts
const attRequest = zkTLS.generateRequestParams(request, responseResolves);
const attestation = await zkTLS.startAttestation(attRequest, 2 * 60 * 1000);
const isValid = await zkTLS.verifyAttestation(attestation);
```

## Default assumptions

- Default algorithm: `proxytls`
- Default result type: `plain`
- Prefer narrow, stable endpoints for first-pass integrations
- Only add `attConditions` when the proof must enforce a bound or comparison
- Action-oriented endpoints may still be attested, but should be presented as an opt-in due to latency and freshness tradeoffs

## Good candidates

- Price snapshot endpoints
- K-line / OHLC endpoints
- Token metadata endpoints
- Ranking / hot list endpoints
- Read-only pool and holder summaries with stable JSON shapes

## Weak candidates

- Wallet-private endpoints with brittle auth requirements
- Quote or execution flows that depend on volatile routing state
- Broadcast endpoints where the chain itself is the stronger source of truth
- Streaming or websocket outputs

Weak candidate does not mean impossible. It means:

- not a good default
- likely needs user confirmation before paying proof overhead
- may require a separate chain-finality step

## Response resolve guidance

- Use one proof per user-visible claim whenever possible.
- Extract the smallest field set that satisfies the prompt.
- Prefer stable paths like `$.data.price` over broad object reveals.
- Use batched requests only when the upstream API and proof payload remain stable.

## Local vs on-chain verification

- Local verification:
  - Fastest choice for interactive agent replies
  - Uses the SDK's built-in attestor expectation
- On-chain verification:
  - Use when the proof must be consumed by a contract
  - Requires a contract wired to `IPrimusZKTLS.verifyAttestation(attestation)`

## Proof semantics for action endpoints

For writable or operation-oriented APIs, distinguish three layers:

1. request/response proof
   - proves what API request was made and what response was returned
2. execution-prep proof
   - proves returned calldata, gas estimate, route summary, or simulation output
3. finality proof
   - proves what happened on-chain, which usually comes from tx hash and chain confirmation rather than zkTLS alone

If the user asks for proof on an action endpoint, allow it, but say which layer is being proven.

## Output contract for these skills

Whenever a verifiable flow is chosen, the agent should clearly separate:

- the upstream claim
- the extracted fields
- whether an attestation was generated
- whether local verification succeeded
- whether the result is ready for on-chain verification

See also:

- `response-contracts.md`
- `fallback-decision-trees.md`
