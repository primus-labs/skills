# Supported Chains

## Currently supported by Primus Network

| Chain | ID | Hex | Type |
|---|---|---|---|
| Base Sepolia | 84532 | 0x14a34 | Testnet (default) |
| Base Mainnet | 8453 | 0x2105 | Mainnet |

More chains coming in future SDK releases.

---

## Base Sepolia (testnet — use for development)

```js
{
  chainId: '0x14a34',
  chainName: 'Base Sepolia',
  rpcUrls: ['https://sepolia.base.org'],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://sepolia.basescan.org'],
}
```

**Faucets:**
- https://www.alchemy.com/faucets/base-sepolia
- https://faucet.quicknode.com/base/sepolia

---

## Base Mainnet

```js
{
  chainId: '0x2105',
  chainName: 'Base',
  rpcUrls: ['https://mainnet.base.org'],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://basescan.org'],
}
```

---

## ensureCorrectChain helper (always include this)

```js
async function ensureCorrectChain(chainId) {
  const hex = '0x' + chainId.toString(16);
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current === hex) return;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hex }],
    });
  } catch (err) {
    if (err.code === 4902) {
      // Chain not in wallet — add it
      const chainConfigs = {
        84532: {
          chainId: '0x14a34',
          chainName: 'Base Sepolia',
          rpcUrls: ['https://sepolia.base.org'],
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        },
        8453: {
          chainId: '0x2105',
          chainName: 'Base',
          rpcUrls: ['https://mainnet.base.org'],
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          blockExplorerUrls: ['https://basescan.org'],
        },
      };
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [chainConfigs[chainId]],
      });
    } else {
      throw err;
    }
  }
}
```
