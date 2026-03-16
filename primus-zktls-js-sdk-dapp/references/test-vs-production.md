# Test Mode vs Production Mode

This is the most important architectural decision when using `@primuslabs/zktls-js-sdk`.

## The Key Difference

The `appSecret` is used to sign attestation requests. Its purpose is to prove that the request came from your application and not from an unauthorized caller.

- **Test mode**: `sign()` is called on the frontend. `appSecret` is visible in the browser. Safe for local development only.
- **Production mode**: `sign()` is called on a backend. `appSecret` is never sent to the browser. Required for any public-facing deployment.

## Side-by-Side Comparison

| | Test Mode | Production Mode |
|---|---|---|
| `init()` call | `init(appId, appSecret)` | Frontend: `init(appId)` · Backend: `init(appId, appSecret)` |
| `sign()` location | Frontend | Backend only |
| `appSecret` exposure | Visible in browser JS | Never leaves server |
| Use case | Local dev, internal tools | Any public deployment |
| Backend required | No | Yes |

---

## Test Mode — Complete Frontend Code

```js
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';

// ── Constants ──────────────────────────────────────────────
const APP_ID     = 'YOUR_APP_ID';
const APP_SECRET = 'YOUR_APP_SECRET';   // ⚠ test only, never deploy this
const TEMPLATE_ID = 'YOUR_TEMPLATE_ID';

// ── State ──────────────────────────────────────────────────
let userAddress = '';

// ── DOM refs (before any function) ────────────────────────
const btnAttest   = document.getElementById('btn-attest');
const addressInput = document.getElementById('address-input');
const logEl        = document.getElementById('log');
const resultEl     = document.getElementById('result');

// ── SDK init at page load ──────────────────────────────────
const primusZKTLS = new PrimusZKTLS();
await primusZKTLS.init(APP_ID, APP_SECRET);
console.log('SDK initialized');

// ── Attestation handler ────────────────────────────────────
btnAttest.addEventListener('click', async () => {
  btnAttest.disabled = true;
  userAddress = addressInput.value.trim();
  if (!userAddress) { alert('Enter a wallet address'); btnAttest.disabled = false; return; }

  try {
    // 1. Generate request
    const request = primusZKTLS.generateRequestParams(TEMPLATE_ID, userAddress);

    // 2. Optional: set mode
    request.setAttMode({ algorithmType: 'proxytls' });

    // 3. Optional: set conditions
    // request.setAttConditions([[{ field: 'YOUR_FIELD', op: 'SHA256' }]]);

    // 4. Optional: add custom params
    // request.setAdditionParams(JSON.stringify({ sessionId: '123' }));

    // 5. Serialize + sign (frontend in test mode)
    const requestStr     = request.toJsonString();
    const signedRequestStr = await primusZKTLS.sign(requestStr);

    // 6. Run attestation (opens Primus extension popup)
    const attestation = await primusZKTLS.startAttestation(signedRequestStr);

    // 7. Verify signature — ALWAYS do this
    const verifyResult = await primusZKTLS.verifyAttestation(attestation);
    if (!verifyResult) throw new Error('Signature verification failed');

    // 8. Parse data
    let data = attestation.data;
    try { data = JSON.parse(attestation.data); } catch (_) {}
    console.log('Verified data:', data);
    resultEl.textContent = JSON.stringify(attestation, null, 2);

  } catch (err) {
    console.error(err);
    logEl.textContent = 'Error: ' + (err.message || JSON.stringify(err));
  } finally {
    btnAttest.disabled = false;
  }
});
```

---

## Production Mode — Frontend

```js
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';

const APP_ID      = 'YOUR_APP_ID';    // safe to expose
const TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const SIGN_API    = '/primus/sign';   // your backend endpoint

// Init without appSecret
const primusZKTLS = new PrimusZKTLS();
await primusZKTLS.init(APP_ID);

btnAttest.addEventListener('click', async () => {
  const request    = primusZKTLS.generateRequestParams(TEMPLATE_ID, userAddress);
  request.setAttMode({ algorithmType: 'proxytls' });
  const requestStr = request.toJsonString();

  // Get signature from backend
  const res = await fetch(`${SIGN_API}?signParams=${encodeURIComponent(requestStr)}`);
  const { signResult } = await res.json();

  const attestation  = await primusZKTLS.startAttestation(signResult);
  const verifyResult = await primusZKTLS.verifyAttestation(attestation);
  if (!verifyResult) throw new Error('Signature verification failed');

  let data = attestation.data;
  try { data = JSON.parse(attestation.data); } catch (_) {}
  console.log('Verified data:', data);
});
```

---

## Production Mode — Backend (Express)

```js
// backend/server.js
const express    = require('express');
const cors       = require('cors');
const { PrimusZKTLS } = require('@primuslabs/zktls-js-sdk');

const app = express();
app.use(cors());  // restrict origin in production

app.get('/primus/sign', async (req, res) => {
  const primusZKTLS = new PrimusZKTLS();
  await primusZKTLS.init(process.env.APP_ID, process.env.APP_SECRET);

  const signResult = await primusZKTLS.sign(req.query.signParams);
  res.json({ signResult });
});

app.listen(3001, () => console.log('Sign server on :3001'));
```

```json
// backend/package.json
{
  "name": "primus-sign-backend",
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "@primuslabs/zktls-js-sdk": "latest",
    "express": "^4.18.0",
    "cors": "^2.8.5"
  }
}
```

Backend `.env`:
```
APP_ID=your_app_id
APP_SECRET=your_app_secret
```

---

## Mobile Device Support

If the DApp may run on Android:

```js
// Detect platform
let platform = 'pc';
if (navigator.userAgent.toLowerCase().includes('android')) platform = 'android';
else if (navigator.userAgent.toLowerCase().includes('iphone')) platform = 'ios';

// Pass as third arg to init
await primusZKTLS.init(APP_ID, APP_SECRET, { platform });

// Production (no appSecret on frontend):
await primusZKTLS.init(APP_ID, '', { platform });
```

iOS support is listed as "coming soon" in Primus docs as of early 2026.
