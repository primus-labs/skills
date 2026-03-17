# Chains Reference — network-core-sdk

## Supported Chains

| Chain | chainId | RPC URL |
|---|---|---|
| Base Sepolia (testnet) | `84532` | `https://sepolia.base.org` |
| Base mainnet | `8453` | `https://mainnet.base.org` |

More chains will be added in future SDK releases.

## Setup Code

```js
// Base Sepolia (development)
const CHAIN_ID = 84532;
const RPC_URL  = 'https://sepolia.base.org';

// Base mainnet (production)
const CHAIN_ID = 8453;
const RPC_URL  = 'https://mainnet.base.org';

const provider = new ethers.providers.JsonRpcProvider(RPC_URL); // ethers v5
const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
```

## ETH Faucets (Base Sepolia)

- https://www.alchemy.com/faucets/base-sepolia
- https://faucet.quicknode.com/base/sepolia

## Deriving Address from Private Key

```js
const { ethers } = require('ethers');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
console.log('Address:', wallet.address);
// Use this as ADDRESS in submitTask params
```
