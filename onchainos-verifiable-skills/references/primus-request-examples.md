# Primus Request Examples

These examples translate selected OKX OnchainOS endpoints into `AttNetworkRequest` and `AttNetworkResponseResolve` inputs for `@primuslabs/zktls-core-sdk`.

Replace placeholder auth headers with the real signed OKX headers required by your integration.

## 1. Market price

```ts
const request = {
  url: "https://web3.okx.com/api/v6/dex/market/price",
  method: "POST",
  header: {
    "content-type": "application/json",
    "ok-access-key": process.env.OKX_API_KEY!,
    "ok-access-sign": "<signed-value>",
    "ok-access-passphrase": process.env.OKX_PASSPHRASE!,
    "ok-access-timestamp": "<iso-timestamp>"
  },
  body: [
    {
      chainIndex: "1",
      tokenContractAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    }
  ]
};

const responseResolves = [
  { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].chainIndex" },
  { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenContractAddress" },
  { keyName: "time", parseType: "json", parsePath: "$.data[0].time" },
  { keyName: "price", parseType: "json", parsePath: "$.data[0].price" }
];
```

## 2. Token search

```ts
const request = {
  url: "https://web3.okx.com/api/v6/dex/market/token/search?chains=501&search=BONK",
  method: "GET",
  header: {
    accept: "application/json",
    "ok-access-key": process.env.OKX_API_KEY!,
    "ok-access-sign": "<signed-value>",
    "ok-access-passphrase": process.env.OKX_PASSPHRASE!,
    "ok-access-timestamp": "<iso-timestamp>"
  },
  body: ""
};

const responseResolves = [
  { keyName: "chainIndex", parseType: "json", parsePath: "$.data[0].chainIndex" },
  { keyName: "token", parseType: "json", parsePath: "$.data[0].tokenContractAddress" },
  { keyName: "symbol", parseType: "json", parsePath: "$.data[0].tokenSymbol" },
  { keyName: "name", parseType: "json", parsePath: "$.data[0].tokenName" },
  { keyName: "communityRecognized", parseType: "json", parsePath: "$.data[0].tagList.communityRecognized" }
];
```

## 3. Specific wallet token balance

```ts
const request = {
  url: "https://web3.okx.com/api/v6/dex/balance/token-balances-by-address",
  method: "POST",
  header: {
    "content-type": "application/json",
    "ok-access-key": process.env.OKX_API_KEY!,
    "ok-access-sign": "<signed-value>",
    "ok-access-passphrase": process.env.OKX_PASSPHRASE!,
    "ok-access-timestamp": "<iso-timestamp>"
  },
  body: {
    address: "0xabc...",
    tokenContractAddresses: [
      {
        chainIndex: "1",
        tokenContractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      }
    ]
  }
};

const responseResolves = [
  { keyName: "symbol", parseType: "json", parsePath: "$.data[0].tokenAssets[0].symbol" },
  { keyName: "balance", parseType: "json", parsePath: "$.data[0].tokenAssets[0].balance" },
  { keyName: "tokenPrice", parseType: "json", parsePath: "$.data[0].tokenAssets[0].tokenPrice" },
  { keyName: "isRiskToken", parseType: "json", parsePath: "$.data[0].tokenAssets[0].isRiskToken" }
];
```

## 4. Swap quote

```ts
const request = {
  url: "https://web3.okx.com/api/v6/dex/aggregator/quote?chainIndex=1&amount=1000000&swapMode=exactIn&fromTokenAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&toTokenAddress=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  method: "GET",
  header: {
    accept: "application/json",
    "ok-access-key": process.env.OKX_API_KEY!,
    "ok-access-sign": "<signed-value>",
    "ok-access-passphrase": process.env.OKX_PASSPHRASE!,
    "ok-access-timestamp": "<iso-timestamp>"
  },
  body: ""
};

const responseResolves = [
  { keyName: "fromTokenAmount", parseType: "json", parsePath: "$.data[0].fromTokenAmount" },
  { keyName: "toTokenAmount", parseType: "json", parsePath: "$.data[0].toTokenAmount" },
  { keyName: "tradeFee", parseType: "json", parsePath: "$.data[0].tradeFee" },
  { keyName: "estimateGasFee", parseType: "json", parsePath: "$.data[0].estimateGasFee" },
  { keyName: "priceImpactPercent", parseType: "json", parsePath: "$.data[0].priceImpactPercent" }
];
```

## 5. Gateway gas price

```ts
const request = {
  url: "https://web3.okx.com/api/v6/dex/pre-transaction/gas-price?chainIndex=1",
  method: "GET",
  header: {
    accept: "application/json",
    "ok-access-key": process.env.OKX_API_KEY!,
    "ok-access-sign": "<signed-value>",
    "ok-access-passphrase": process.env.OKX_PASSPHRASE!,
    "ok-access-timestamp": "<iso-timestamp>"
  },
  body: ""
};

const responseResolves = [
  { keyName: "normal", parseType: "json", parsePath: "$.data[0].normal" },
  { keyName: "min", parseType: "json", parsePath: "$.data[0].min" },
  { keyName: "max", parseType: "json", parsePath: "$.data[0].max" },
  { keyName: "supportEip1559", parseType: "json", parsePath: "$.data[0].supportEip1559" },
  { keyName: "suggestBaseFee", parseType: "json", parsePath: "$.data[0].eip1599Protocol.suggestBaseFee" },
  { keyName: "proposePriorityFee", parseType: "json", parsePath: "$.data[0].eip1599Protocol.proposePriorityFee" }
];
```

## Validation reminder

After creating a request and resolve set:

```ts
const attRequest = zkTLS.generateRequestParams(request, responseResolves);
const attestation = await zkTLS.startAttestation(attRequest, 120_000);
const isValid = await zkTLS.verifyAttestation(attestation);
```

Only call a result verified when the attestation was generated and `isValid === true`.
