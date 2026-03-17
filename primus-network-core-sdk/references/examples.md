# Examples — network-core-sdk

## 1. Single URL, Plaintext (simplest)

```js
require('dotenv').config();
const { PrimusNetwork } = require('@primuslabs/network-core-sdk');
const { ethers } = require('ethers');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');
const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const requests = [
  {
    url:    'https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=BTC-USD',
    method: 'GET',
    header: {},
    body:   '',
  },
];

const responseResolves = [
  [
    {
      keyName:   'instType',
      parseType: 'json',
      parsePath: '$.data[0].instType',
      // op omitted → defaults to REVEAL_STRING (plaintext)
    },
  ],
];

async function main() {
  const primusNetwork = new PrimusNetwork();
  await primusNetwork.init(wallet, 84532);

  const submitTaskParams = { address: process.env.ADDRESS };
  const submitTaskResult = await primusNetwork.submitTask(submitTaskParams);

  const attestResult = await primusNetwork.attest({
    ...submitTaskParams,
    ...submitTaskResult,
    requests,
    responseResolves,
  });

  const data = JSON.parse(attestResult[0].attestation.data);
  console.log('instType:', data.instType); // e.g. "SPOT"
}

main().catch(console.error);
```

---

## 2. Single URL, Privacy — SHA256 + Condition

```js
const responseResolves = [
  [
    {
      keyName:   'userId',
      parseType: 'json',
      parsePath: '$.data.uid',
      op:        'SHA256',           // returns hash, never reveals raw value
    },
    {
      keyName:   'tradeVolume',
      parseType: 'json',
      parsePath: '$.data.totalVol',
      op:        '>',
      value:     '10000',            // returns "true" or "false"
    },
  ],
];
```

---

## 3. Multiple URLs

```js
const requests = [
  {
    url:    'https://api.exchange.com/api/v5/market/index-tickers?instId=BTC-USDT',
    method: 'GET',
    header: {},
    body:   '',
  },
  {
    url:    'https://api.exchange.com/api/v5/market/index-tickers?instId=ETH-USDT',
    method: 'GET',
    header: {},
    body:   '',
  },
];

const responseResolves = [
  // Fields from requests[0] (BTC)
  [
    { keyName: 'btcPrice', parseType: 'json', parsePath: '$.data[0].idxPx' },
    { keyName: 'btcVol',   parseType: 'json', parsePath: '$.data[0].vol24h', op: '>', value: '1000' },
  ],
  // Fields from requests[1] (ETH)
  [
    { keyName: 'ethPrice', parseType: 'json', parsePath: '$.data[0].idxPx' },
  ],
];

// Both URLs attested in a single attest() call
const attestResult = await primusNetwork.attest({
  ...submitTaskParams,
  ...submitTaskResult,
  requests,
  responseResolves,
});
```

Result `attestation.data` will contain all fields from both URLs:
```json
{
  "btcPrice": "89016.4",
  "btcPrice.count": "1",
  "btcVol": "true",
  "ethPrice": "3200.5",
  "ethPrice.count": "1"
}
```

---

## 4. POST Request with Auth Headers

```js
const requests = [
  {
    url:    'https://api.binance.com/api/v3/account',
    method: 'GET',
    header: {
      'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
    },
    body: '',
  },
];

const responseResolves = [
  [
    {
      keyName:   'canTrade',
      parseType: 'json',
      parsePath: '$.canTrade',
    },
    {
      keyName:   'accountType',
      parseType: 'json',
      parsePath: '$.accountType',
    },
  ],
];
```

---

## 5. DVC Workflow (getAllJsonResponse)

```js
const responseResolves = [
  [
    {
      keyName:   'balance',
      parseType: 'json',
      parsePath: '$.data.balance',
      op:        'SHA256',   // hash in attestation; raw available via getAllJsonResponse
    },
  ],
];

const attestResult = await primusNetwork.attest({
  ...submitTaskParams,
  ...submitTaskResult,
  requests,
  responseResolves,
  getAllJsonResponse: 'true',   // ← must be string 'true', not boolean
});

// Attestation contains the hash:
const data = JSON.parse(attestResult[0].attestation.data);
// data.balance = "0xabc123..."  ← SHA256 hash

// Raw HTTP response (for zkVM input):
const allJsonResponse = await primusNetwork.getAllJsonResponse(attestResult[0].taskId);
// allJsonResponse[0].content = '{"data":{"balance":"12345.67",...}}'  ← raw response body
```

---

## 6. Mutual TLS (mTLS)

```js
const fs = require('fs');

const attestResult = await primusNetwork.attest({
  ...submitTaskParams,
  ...submitTaskResult,
  requests,
  responseResolves,
  mTLS: {
    clientKey: fs.readFileSync('./certs/client.key').toString(), // PEM string
    clientCrt: fs.readFileSync('./certs/client.crt').toString(), // PEM string
  },
});
```

---

## 7. mpctls Mode (when target API blocks proxy IPs)

```js
const attestResult = await primusNetwork.attest({
  ...submitTaskParams,
  ...submitTaskResult,
  requests,
  responseResolves,
  attMode: {
    algorithmType: 'mpctls',
  },
});
```

Use `mpctls` when:
- Getting error 10003 with proxytls
- The target API (e.g. Binance, some CEXes) detects and blocks Primus proxy node IPs
- You need to appear to come from a non-datacenter IP
