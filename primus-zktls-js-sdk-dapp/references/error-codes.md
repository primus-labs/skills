# Error Codes — Primus zkTLS-JS-SDK

Source: https://docs.primuslabs.xyz/enterprise/error-code/
SDK messages: https://github.com/primus-labs/zktls-js-sdk/blob/main/src/error.ts

Preserve the error code as a string, including leading zeros. When contacting
Primus, include the code and the subcode when present. A code identifies a
failure category; it does not by itself establish the underlying cause.

## General Errors

| Code | Situation / next step |
|---|---|
| `00000` | Too many requests. Wait before retrying. |
| `00001` | Algorithm startup failed. Complete `init()`, refresh if necessary, then retry. |
| `00003` | A verification is already running. Prevent concurrent calls. |
| `00004` | User cancelled. Offer a manual restart. |
| `00005` | Invalid SDK parameters. Check the signed request and template. |
| `00006` | Extension not detected. Install and enable the official Primus extension, then refresh. |
| `00012` | Invalid template ID. Check the project's template configuration. |
| `00104` | Verification requirements not met. This can be an expected condition result. |

## zkTLS Errors

| Code | Situation / next step |
|---|---|
| `00002` | Verification timed out. Check the flow and retry manually. |
| `00013` | No verifiable data detected. Confirm login status and account details. |
| `00014` | Verification timed out after a connection interruption. |
| `10001` | Unstable internet connection. |
| `10002` | Network interrupted during attestation. |
| `10003` | Connection to the attestation server interrupted. |
| `10004` | Connection to the data source server interrupted. |
| `20001`, `20002`, `20004`, `20005` | Internal runtime error. Contact Primus. |
| `20003` | Invalid algorithm parameters. Check the chosen SDK mode. |
| `30001` | Response error. Preserve any subcode; see below. |
| `30002` | Response validation error. |
| `30003` | Response parsing error. |
| `30004` | JSON parsing error. Contact Primus if it persists. |
| `30005` | HTML parsing error. |
| `30006` | Preset path key missing from the response. Contact Primus. |
| `40001` | Internal FileNotExistException. Contact Primus. |
| `40002` | SSL certificate error. Contact Primus. |
| `50000` | Internal algorithm error; may include a subcode. Contact Primus. |
| `50003` | Unexpected client error. |
| `50004` | Client did not start correctly. |
| `50006` | Algorithm server not started. |
| `50009` | Algorithm service timeout. |
| `50011` | Unsupported TLS version. Contact Primus. |
| `99999` | Undefined error. Do not infer a specific cause. |

### Response subcodes in the SDK message map

| Code / subcode | SDK interpretation |
|---|---|
| `30001` / `301`, `404` | Request URL not detected. |
| `30001` / `302` | Response error. |
| `30001` / `401` | Session expired; sign in again. |
| `30001` / `403` | Access blocked by the data source's risk controls. |
| `30001` / `429` | Data source rate limit; wait before retrying. |
| `50000` / `501`, `502`, `505`, `507`, `508`, `510` | Internal algorithm error. |

Preserve unrecognized subcodes as well. Do not silently discard them or convert
`0` to an absent value. Older SDK payloads can place the subcode in
`data.details.subCode`; current SDK error objects can expose it at `subCode`.

## Account & Subscription Errors

| Code | Situation |
|---|---|
| `-1002001` | Invalid app ID. |
| `-1002002` | Invalid app secret. |
| `-1002003` | Trial quota exhausted. |
| `-1002004` | Subscription expired. |
| `-1002005` | Quota exhausted. |

Keep production app secrets on the signing server.

## Error Handling Pattern

```js
async function runVerification(signedRequestStr) {
  try {
    const attestation = await primusZKTLS.startAttestation(signedRequestStr);
    const verified = await primusZKTLS.verifyAttestation(attestation);
    if (verified !== true) {
      showError('Signature verification failed.');
      return;
    }
    // Apply the application's source, recipient, freshness and business rules.
  } catch (err) {
    const error = err?.errorData ?? err;
    const code = String(error?.code ?? 'unknown');
    let data = error?.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = undefined; }
    }
    const subCode = error?.subCode ?? error?.details?.subCode ?? data?.details?.subCode;
    const reference = subCode == null ? code : `${code} / ${String(subCode)}`;
  
    if (code === '00004') {
      showError('Verification cancelled. You can start again when ready.');
    } else if (code === '00006') {
      showError('Install and enable the Primus extension, refresh, then retry.');
    } else if (code === '30001' && String(subCode) === '401') {
      showError('Your data source session expired. Please sign in again.');
    } else {
      showError(`Verification failed (${reference}). Check the official error reference or contact Primus.`);
    }
    // A support report should allowlist code/subcode, failed stage and versions.
    // Do not dump err, headers, cookies, raw responses or attestations into it.
  }
}
```

`30004` describes JSON parsing failure. Authentication problems or endpoint
changes may be investigated with additional evidence; this code alone does not
prove that the user is logged out. An unrecognized code such as `0` must remain
unmapped until its origin is understood.
