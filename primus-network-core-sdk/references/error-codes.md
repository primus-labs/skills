# Error Codes — network-core-sdk

Source: https://docs.primuslabs.xyz/build/misc/error-code

## General Errors

| Code | Situation | Cause & Fix |
|---|---|---|
| `00000` | Operation too frequent | Add delay between calls / reduce retry rate |
| `00001` | Algorithm startup exception | SDK not initialized. Ensure `init()` completed before `submitTask()` |
| `00002` | Verification timed out | Network slow or target API unresponsive. Retry. |
| `00003` | Verification in progress | Previous `attest()` call not resolved. Don't call concurrently. |
| `00004` | User cancelled | N/A for backend SDK — should not occur |
| `00005` | Wrong SDK parameters | Check `requests`, `responseResolves`, `address` are all correctly formed |
| `00012` | Invalid Template ID | N/A for core-sdk (no templateId used) |
| `00013` | Target data missing | `parsePath` JSONPath doesn't match the actual response. Verify the path against a real API response first. |
| `00104` | Verification requirements not met | The condition op returned false AND the SDK treats it as an error. This is expected behaviour — handle in catch. |
| `-1002001` | Invalid App ID | N/A for core-sdk |
| `-1002002` | Invalid App Secret | N/A for core-sdk |

## zkTLS Protocol Errors

| Code | Situation | Cause & Fix |
|---|---|---|
| `10001`–`10004` | Unstable internet | Network issue to Primus servers. Retry. If persistent, try `attMode: { algorithmType: 'mpctls' }` |
| `20001` | Internal error | Server-side error. Retry. Report to Discord with error UUID if persistent. |
| `20003` | Invalid algorithm parameters | `attMode.algorithmType` is wrong. Must be `'proxytls'` or `'mpctls'`. |
| `20005` | Internal error | Same as 20001 |
| `30001` | Response error | Target API returned unexpected response. Check URL and headers. |
| `30002` | Response check error | Response failed integrity check. Retry. |
| `30004` | Response parse error | Target API returned empty body. Check auth headers/cookies — the credential may be invalid or expired. |
| `40002` | SSL certificate error | TLS cert issue on target server. Temporary, retry. |
| `50001`–`50011` | Internal / algorithm errors | See table below. |
| `99999` | Undefined error | Report to Discord with UUID. |

## 50xxx Detail

| Code | Meaning |
|---|---|
| `50001` | Internal error |
| `50003` | Client unexpected error |
| `50004` | Client not started — retry |
| `50006` | Algorithm server not started — retry |
| `50007` | Algorithm execution issue |
| `50008` | Abnormal execution result |
| `50009` | Algorithm timed out |
| `50010` | Compatibility issue |
| `50011` | Unsupported TLS version |

## submitTask-Specific Errors

These occur before `attest()` and are ethers/blockchain errors, not Primus error codes:

| Error | Cause | Fix |
|---|---|---|
| `insufficient funds` | Wallet has no ETH for gas | Fund the wallet on the target chain |
| `nonce too low` | Transaction replay | Restart — nonce mismatch from a previous failed tx |
| `timeout` | RPC node unresponsive | Try a different RPC URL |
| `CALL_EXCEPTION` | Contract revert | Wrong chainId or SDK version mismatch |

## Error Handling Pattern

```js
try {
  const attestResult = await primusNetwork.attest(attestParams);
  const data = JSON.parse(attestResult[0].attestation.data);
  console.log('Verified data:', data);
} catch (err) {
  const code = String(err?.code || err?.errorData?.code || '');

  if (code.startsWith('10')) {
    console.error(`Network error (${code}). Retrying with mpctls...`);
    // retry with attMode: { algorithmType: 'mpctls' }
  } else if (code === '30004') {
    console.error('Target API returned empty body. Check credentials.');
  } else if (code === '00013') {
    console.error('parsePath does not match API response. Verify JSONPath.');
  } else {
    console.error(`Attestation failed (${code}):`, err.message || err);
  }
}
```

## 30004 Specifically (most common with authenticated APIs)

Error `30004` means the target API returned an empty response body. In backend context:

1. **Auth header/cookie is wrong or expired** — the credential in `requests[i].header` is invalid
2. **Session expired** — token TTL exceeded; refresh and retry
3. **IP blocked by target** — the Primus proxy IP is blocked by the target API. Switch to `mpctls`:
   ```js
   attMode: { algorithmType: 'mpctls' }
   ```
4. **parsePath mismatch** — the field exists but on a different path — check with `REVEAL_STRING` first, then add privacy ops
