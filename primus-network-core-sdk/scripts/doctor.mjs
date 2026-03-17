#!/usr/bin/env node
/**
 * doctor.mjs — Validates a primus-network-core-sdk project.
 * Usage: node scripts/doctor.mjs <path-to-project-src>
 * Example: node scripts/doctor.mjs ./src
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const targetDir = process.argv[2] || '.';
const abs = (...parts) => resolve(targetDir, ...parts);

let passed = 0, failed = 0;
const errors = [];

function check(label, condition, hint) {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else {
    console.log(`  ✗  ${label}`);
    if (hint) console.log(`       → ${hint}`);
    errors.push(label); failed++;
  }
}

function readFile(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

console.log('\nPrimus Network-Core-SDK Doctor\n');

// ── Files ──────────────────────────────────────────────────
console.log('[ Files ]');
const srcDir  = existsSync(abs('src')) ? abs('src') : abs('.');
const mainJs  = readFile(abs('src/index.js')) || readFile(abs('index.js')) || readFile(abs('src/main.js'));
const pkgJson = readFile(abs('package.json')) || readFile(abs('../package.json'));
const envEx   = readFile(abs('.env.example')) || readFile(abs('../.env.example'));

check('src/index.js or index.js exists',   mainJs.length > 0);
check('package.json exists',               pkgJson.length > 0);
check('.env.example exists',               envEx.length > 0,
  'Create .env.example to document required secrets (PRIVATE_KEY, ADDRESS)');

const gitignore = readFile(abs('.gitignore')) || readFile(abs('../.gitignore'));
check('.gitignore exists and excludes .env',
  gitignore.includes('.env'),
  'CRITICAL: Create .gitignore with .env listed. Without this, git commit will expose your private key.');

// ── package.json ───────────────────────────────────────────
console.log('\n[ package.json ]');
check('Uses @primuslabs/network-core-sdk',
  pkgJson.includes('@primuslabs/network-core-sdk'),
  'Install with: npm install @primuslabs/network-core-sdk');
check('Uses ethers v5 (not v6)',
  pkgJson.includes('"ethers": "^5') || pkgJson.includes('"ethers": "5'),
  'Use ethers v5: "ethers": "^5.7.0". The SDK uses ethers v5 APIs (JsonRpcProvider, Wallet).');
check('Has dotenv dependency',
  pkgJson.includes('"dotenv"'),
  'Add dotenv for loading .env secrets: npm install dotenv');

// ── index.js ───────────────────────────────────────────────
console.log('\n[ src/index.js ]');

check('Loads dotenv',
  mainJs.includes("require('dotenv')") || mainJs.includes('require("dotenv")'),
  'Add require("dotenv").config() at the top to load .env secrets');

check('Uses require() for network-core-sdk (CJS)',
  mainJs.includes('network-core-sdk'),
  'Import with: const { PrimusNetwork } = require("@primuslabs/network-core-sdk")');

check('Uses ethers.providers.JsonRpcProvider (v5 API)',
  mainJs.includes('JsonRpcProvider'),
  'Use ethers v5: new ethers.providers.JsonRpcProvider(RPC_URL). Not ethers.JsonRpcProvider (v6).');

check('Uses ethers.Wallet',
  mainJs.includes('ethers.Wallet') || mainJs.includes('new Wallet'),
  'Create wallet with: new ethers.Wallet(PRIVATE_KEY, provider)');

check('PRIVATE_KEY loaded from env',
  mainJs.includes('process.env') && mainJs.includes('PRIVATE_KEY'),
  'Never hardcode private key. Use: process.env.PRIVATE_KEY');

check('primusNetwork.init() is called',
  mainJs.includes('.init('),
  'Must call await primusNetwork.init(wallet, chainId) before submitTask');

check('submitTask() is called',
  mainJs.includes('submitTask('),
  'Must call await primusNetwork.submitTask({ address }) to register on-chain');

check('requests array is defined',
  mainJs.includes('requests') && (mainJs.includes('url:') || mainJs.includes("url:")),
  'Define requests array: [{ url, method, header, body }]');

check('responseResolves array is defined',
  mainJs.includes('responseResolves') && mainJs.includes('parsePath'),
  'Define responseResolves array with keyName, parseType, parsePath for each field');

check('Both submitTaskParams and submitTaskResult spread into attest()',
  mainJs.includes('...submitTaskParams') && mainJs.includes('...submitTaskResult'),
  'Spread both: attest({ ...submitTaskParams, ...submitTaskResult, requests, responseResolves })');

check('attestResult[0] is used (not attestResult.taskId)',
  mainJs.includes('attestResult[0]'),
  'attestResult is an array. Access first item with attestResult[0]');

check('attestation.data is parsed (not used raw)',
  mainJs.includes('JSON.parse') && mainJs.includes('attestation.data'),
  'attestation.data is a JSON string. Always JSON.parse(attestResult[0].attestation.data)');

check('attMode uses nested algorithmType (not flat attMode string)',
  !mainJs.includes("attMode: 'proxytls'") && !mainJs.includes('attMode: "proxytls"')
  && !mainJs.includes("attMode: 'mpctls'") && !mainJs.includes('attMode: "mpctls"'),
  'core-sdk attMode is nested: attMode: { algorithmType: "proxytls" }. Not attMode: "proxytls" (that is network-js-sdk).');

check('getAllJsonResponse flag is string "true" not boolean',
  !mainJs.includes('getAllJsonResponse: true'),
  'Use getAllJsonResponse: "true" (string), not boolean true');

// ── SKILL.md ───────────────────────────────────────────────
console.log('\n[ SKILL.md ]');
const skill = readFile(abs('SKILL.md')) || readFile(abs('../SKILL.md')) || readFile(abs('../../SKILL.md'));
check('SKILL.md is present', skill.length > 0);
check('Documents requests[] structure',  skill.includes('requests'));
check('Documents responseResolves[]',    skill.includes('responseResolves'));
check('Documents op / privacy options',  skill.includes('SHA256') && skill.includes('REVEAL_STRING'));
check('Documents multiple URLs',         skill.includes('Multiple URL'));
check('Documents ethers v5 requirement', skill.includes('ethers v5'));

// ── Summary ────────────────────────────────────────────────
console.log(`\n─────────────────────────────────`);
console.log(`  Passed: ${passed}   Failed: ${failed}`);
if (failed === 0) {
  console.log(`\n  ✅ All checks passed.\n`);
} else {
  console.log(`\n  ❌ ${failed} issue(s):\n`);
  errors.forEach(e => console.log(`     • ${e}`));
  console.log('');
  process.exit(1);
}
