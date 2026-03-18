# Primus zkTLS Patterns For Binance

This package uses `primus-zktls-core-sdk` as the proof layer for suitable Binance HTTPS calls.

## Baseline flow

1. Initialize once:

```ts
import { PrimusCoreTLS } from "@primuslabs/zktls-core-sdk";

const zkTLS = new PrimusCoreTLS();
await zkTLS.init(appId, appSecret, "auto");
```

2. Build a narrow request:

```ts
const request = {
  url: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
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
    keyName: "symbol",
    parseType: "json",
    parsePath: "$.symbol"
  },
  {
    keyName: "price",
    parseType: "json",
    parsePath: "$.price"
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
- Prefer public market-data endpoints for first-pass integrations
- Keep headers minimal and deterministic
- For signed private queries, prove only the minimum safe response fields

## Good first candidates

- Spot price snapshots
- Latest spot candles
- Futures premium index and funding snapshots
- Margin price index
- Alpha token discovery lists with small page sizes

## Weak first candidates

- Long order books
- Order placement or cancel responses
- Account statements with many assets
- Endpoints with unstable arrays or highly dynamic pagination

Weak candidate does not mean impossible. It means:

- not a good default
- needs careful field minimization
- may require extra explanation about what exactly is being proven

## Public vs signed Binance requests

- Public requests:
  - usually only need `Accept: application/json`
  - are the best default proof targets
- Signed requests:
  - use `X-MBX-APIKEY`
  - include `timestamp` and `signature`
  - should only reveal the minimum fields needed for the claim

## Proof semantics for exchange actions

For action endpoints, separate:

1. request-response proof
   - proves the API response for the submitted request
2. exchange acknowledgement proof
   - proves what Binance returned at that moment
3. execution or settlement truth
   - not guaranteed by zkTLS alone

For create-order or cancel-order flows, never imply the proof alone establishes final execution.
