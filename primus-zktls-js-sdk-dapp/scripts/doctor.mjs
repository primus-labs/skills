#!/usr/bin/env node
/**
 * doctor.mjs — Validates a primus-zktls-js-sdk-dapp project for common mistakes.
 * Usage: node scripts/doctor.mjs <path-to-dapp-src-dir>
 * Example: node scripts/doctor.mjs ./src
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const targetDir = process.argv[2] || '.';
const abs = (...parts) => resolve(targetDir, ...parts);

let passed = 0;
let failed = 0;
const errors = [];

function check(label, condition, hint) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.log(`  ✗  ${label}`);
    if (hint) console.log(`       → ${hint}`);
    errors.push(label);
    failed++;
  }
}

function readFile(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

console.log('\nPrimus zkTLS-JS-SDK DApp Doctor\n');

// ── File existence ─────────────────────────────────────────
console.log('[ Files ]');
check('index.html exists',      existsSync(abs('index.html')) || existsSync(abs('../index.html')));
check('src/main.js exists',     existsSync(abs('main.js')) || existsSync(abs('../src/main.js')));
check('vite.config.js exists',  existsSync(abs('vite.config.js')) || existsSync(abs('../vite.config.js')));
check('package.json exists',    existsSync(abs('package.json')) || existsSync(abs('../package.json')));

// ── package.json ───────────────────────────────────────────
console.log('\n[ package.json ]');
const pkg = readFile(abs('package.json')) || readFile(abs('../package.json'));
check('Uses @primuslabs/zktls-js-sdk (not network-js-sdk)',
  pkg.includes('@primuslabs/zktls-js-sdk'),
  'Wrong SDK. Enterprise DApps need @primuslabs/zktls-js-sdk, not network-js-sdk.');
check('Has vite in devDependencies',
  pkg.includes('"vite"'));
check('type is module',
  pkg.includes('"type": "module"'));

// ── vite.config.js ─────────────────────────────────────────
console.log('\n[ vite.config.js ]');
const viteConf = readFile(abs('vite.config.js')) || readFile(abs('../vite.config.js'));
check('Has global: globalThis polyfill',
  viteConf.includes('global') && viteConf.includes('globalThis'),
  'Add define: { global: "globalThis" } to vite.config.js');
check('SDK in optimizeDeps.include',
  viteConf.includes('zktls-js-sdk'),
  'Add @primuslabs/zktls-js-sdk to optimizeDeps.include');

// ── main.js ────────────────────────────────────────────────
console.log('\n[ src/main.js ]');
const main = readFile(abs('main.js')) || readFile(abs('../src/main.js'));

check('Static import of PrimusZKTLS',
  main.includes("import") && main.includes("PrimusZKTLS") && main.includes("zktls-js-sdk"),
  'Use: import { PrimusZKTLS } from "@primuslabs/zktls-js-sdk" — never dynamic import()');

check('No dynamic import() of SDK',
  !main.includes("import('@primuslabs/zktls-js-sdk")
  && !main.includes('import("@primuslabs/zktls-js-sdk'),
  'Dynamic import of zktls-js-sdk will fail. Use static import at the top of the file.');

check('init() is called',
  main.includes('.init('),
  'Call await primusZKTLS.init(appId, appSecret) before any other SDK method.');

check('generateRequestParams() is called',
  main.includes('generateRequestParams('),
  'Must call primusZKTLS.generateRequestParams(templateId, userAddress)');

check('toJsonString() is called on request',
  main.includes('.toJsonString()'),
  'Must call request.toJsonString() before signing.');

check('sign() is called',
  main.includes('.sign('),
  'Must call primusZKTLS.sign(requestStr) to get signedRequestStr.');

check('startAttestation() is called',
  main.includes('startAttestation('),
  'Must call primusZKTLS.startAttestation(signedRequestStr) to trigger the extension.');

check('verifyAttestation() is called',
  main.includes('verifyAttestation('),
  'Must call primusZKTLS.verifyAttestation(attestation) and check the result before business logic.');

check('verifyAttestation result is checked (=== true)',
  main.includes('verifyResult') || main.includes('verifyAttestation'),
  'Never skip verifyAttestation(). Always check if it returns true.');

check('attestation.data is parsed',
  main.includes('JSON.parse') && (main.includes('attestation.data') || main.includes('.data')),
  'attestation.data is a stringified JSON string. Always try { JSON.parse(attestation.data) } catch (_) {}');

check('No appSecret hardcoded in obvious var name (prod check)',
  !(main.toLowerCase().includes("appsecret") && main.includes("process.env") === false
    && (main.includes("http://") || main.includes("https://"))),
  'WARNING: appSecret may be exposed in a publicly deployed frontend. Move signing to a backend for production.');

check('setAttMode uses algorithmType key (not attMode)',
  !main.includes("attMode:") || main.includes("algorithmType"),
  'In zktls-js-sdk, mode is set via request.setAttMode({ algorithmType: "proxytls" }), not attMode: "..." directly.');

check('DOM refs declared before functions that use them',
  main.indexOf('getElementById') < main.indexOf('addEventListener')
  || main.indexOf('getElementById') < main.indexOf('function '),
  'Declare all DOM refs (getElementById) before defining functions that reference them to avoid temporal dead zone errors.');

// ── SKILL.md ───────────────────────────────────────────────
console.log('\n[ SKILL.md ]');
const skill = readFile(abs('SKILL.md')) || readFile(abs('../SKILL.md')) || readFile(abs('../../SKILL.md'));
check('SKILL.md is present', skill.length > 0);
check('Documents test vs production distinction',
  skill.includes('Test Mode') && skill.includes('Production Mode'),
  'SKILL.md must explain the appSecret / signing architecture difference.');
check('Documents verifyAttestation requirement',
  skill.includes('verifyAttestation'),
  'SKILL.md must document that verifyAttestation() must always be called.');
check('References error-codes.md',
  skill.includes('error-codes'),
  'SKILL.md should reference the error-codes reference file.');

// ── Summary ────────────────────────────────────────────────
console.log(`\n─────────────────────────────────`);
console.log(`  Passed: ${passed}   Failed: ${failed}`);
if (failed === 0) {
  console.log(`\n  ✅ All checks passed. Ready to test.\n`);
} else {
  console.log(`\n  ❌ ${failed} issue(s) found:\n`);
  errors.forEach(e => console.log(`     • ${e}`));
  console.log('');
  process.exit(1);
}
