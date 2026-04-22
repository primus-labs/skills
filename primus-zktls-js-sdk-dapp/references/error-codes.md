# Error Codes — Primus zkTLS-JS-SDK

Source: https://docs.primuslabs.xyz/enterprise/error-code

## General Errors

| Code | Situation | Likely Cause & Fix |
|---|---|---|
| `00000` | Operation too frequent | Rate limit hit. Add delay between calls or reduce retry frequency. |
| `00001` | Algorithm startup exception | SDK or extension not properly initialized. Ensure `init()` completed before calling `startAttestation()`. |
| `00002` | Verification process timed out | User took too long in the extension popup, or network timeout. Retry. |
| `00003` | A verification is already in progress | Previous `startAttestation()` call hasn't resolved. Don't allow concurrent calls — disable the button while running. |
| `00004` | User closed or cancelled | User dismissed the extension popup. Show a retry option. |
| `00005` | Wrong SDK parameters | Missing or malformed params. Check `templateId`, `userAddress`, `appId`, `signedRequestStr`. |
| `00012` | Invalid Template ID | The templateId UUID is wrong or doesn't exist in your project. Verify in dev.primuslabs.xyz. |
| `00013` | Target data missing | The JSON path in the template doesn't match the actual response from the target URL. Check the template's data extraction path at dev.primuslabs.xyz. |
| `00104` | Not met verification requirements | The data exists but failed the `attConditions` comparison (e.g. value was not `> 1000`). This is an expected result, not a bug. |
| `-1002001` | Invalid App ID | appId doesn't exist or is malformed. Check dev.primuslabs.xyz. |
| `-1002002` | Invalid App Secret | appSecret is wrong. Regenerate in dev.primuslabs.xyz. **Never commit appSecret to source control.** |

## zkTLS Protocol Errors

| Code | Situation | Likely Cause & Fix |
|---|---|---|
| `10001`–`10004` | Unstable internet connection | Network issue between extension and Primus servers. Retry. If persistent, check firewall or try changing `algorithmType` to `mpctls` (avoids proxy routing). |
| `20001` | Internal error | Unexpected server-side error. Retry. If persistent, report to Primus Discord with the error UUID. |
| `20003` | Invalid algorithm parameters | `algorithmType` value is wrong. Must be exactly `'proxytls'` or `'mpctls'`. |
| `20005` | Internal error | Same as 20001. |
| `30001` | Response error | The target data source (e.g. Binance, X) returned an unexpected response. Retry. |
| `30002` | Response check error | Response arrived but failed integrity check. Retry. |
| `30004` | Response parse error | Target data source returned an empty or non-JSON body. User is likely **not logged in** to the target service in the extension popup. Ensure the user logs in during the attestation popup. |
| `40002` | SSL certificate error | TLS certificate issue on target server. Usually a temporary problem on the data source side. |
| `50001`–`50011` | Internal / algorithm errors | Various internal execution errors. See table below. |
| `99999` | Undefined error | Catch-all. Report to Discord with UUID from error details. |

## 50xxx Detail Table

| Code | Meaning |
|---|---|
| `50001` | Internal error |
| `50003` | Client unexpected error |
| `50004` | Client not started — retry |
| `50006` | Algorithm server not started — retry |
| `50007` | Algorithm execution issue |
| `50008` | Abnormal execution result |
| `50009` | Algorithm service timed out |
| `50010` | Compatibility issue during algorithm execution |
| `50011` | Unsupported TLS version |

## Error Handling Pattern

```js
try {
  const attestation = await primusZKTLS.startAttestation(signedRequestStr);
  const verifyResult = await primusZKTLS.verifyAttestation(attestation);
  if (verifyResult === true) {
    // success
  } else {
    showError('Signature verification failed.');
  }
} catch (err) {
  const code = err.code || err.errorData?.code || 'unknown';
  const desc = err.message || err.errorData?.desc || JSON.stringify(err);

  if (code === '00004') {
    showError('Attestation cancelled. You can try again.');
  } else if (code === '30004') {
    showError('Could not read data from the target service. Please log in to the service in the popup and try again.');
  } else if (String(code).startsWith('10')) {
    showError(`Network error (${code}). Check your connection or try mpctls mode.`);
  } else {
    showError(`Attestation failed (${code}): ${desc}`);
  }
}
```

## 30004 Specifically (most common in CEX proofs)

Error `30004` (`ParseJsonError`) means the target service (e.g. Binance, Coinbase) returned an empty response body. Root causes in order of likelihood:

1. **User is not logged in** inside the Primus extension popup. The popup must be used to authenticate with the target service — a session in a separate browser tab is not enough.
2. **Session expired** — user was logged in but the session token expired. Log out and log back in inside the popup.
3. **Target service blocked the request** — some CEXes detect automated traffic. Switching from `proxytls` to `mpctls` routes the request through the user's own browser, reducing detection chance.
4. **Template endpoint changed** — the URL or response structure in the template no longer matches. Check the template in dev.primuslabs.xyz.
