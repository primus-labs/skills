#!/usr/bin/env node

/**
 * doctor.mjs — Validates a primus-zktls-js-sdk-dapp project for common mistakes.
 * Usage: node scripts/doctor.mjs <path-to-dapp-src-dir>
 * Example: node scripts/doctor.mjs ./src
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

console.log('\nPrimus zkTLS-JS-SDK DApp Doctor\n');

// ── File existence ─────────────────────────────────────────
console.log('[ Files ]');

check(
  'index.html exists',
  existsSync(abs('index.html')) ||
    existsSync(abs('../index.html'))
);

check(
  'src/main.js exists',
  existsSync(abs('main.js')) ||
    existsSync(abs('../src/main.js'))
);

check(
  'vite.config.js exists',
  existsSync(abs('vite.config.js')) ||
    existsSync(abs('../vite.config.js'))
);

check(
  'package.json exists',
  existsSync(abs('package.json')) ||
    existsSync(abs('../package.json'))
);

// ── package.json ───────────────────────────────────────────
console.log('\n[ package.json ]');

const pkg =
  readFile(abs('package.json')) ||
  readFile(abs('../package.json'));

check(
  'Uses @primuslabs/zktls-js-sdk (not network-js-sdk)',
  pkg.includes('@primuslabs/zktls-js-sdk'),
  'Wrong SDK. Enterprise DApps need @primuslabs/zktls-js-sdk, not network-js-sdk.'
);

check(
  'Has vite in devDependencies',
  pkg.includes('"vite"')
);

check(
  'type is module',
  pkg.includes('"type": "module"')
);

// ── vite.config.js ─────────────────────────────────────────
console.log('\n[ vite.config.js ]');

const viteConf =
  readFile(abs('vite.config.js')) ||
  readFile(abs('../vite.config.js'));

check(
  'Has global: globalThis polyfill',
  viteConf.includes('global') &&
    viteConf.includes('globalThis'),
  'Add define: { global: "globalThis" } to vite.config.js'
);

check(
  'SDK in optimizeDeps.include',
  viteConf.includes('zktls-js-sdk'),
  'Add @primuslabs/zktls-js-sdk to optimizeDeps.include'
);

// ── main.js ────────────────────────────────────────────────
console.log('\n[ src/main.js ]');

const main =
  readFile(abs('src/main.js')) ||
  readFile(abs('main.js')) ||
  readFile(abs('../src/main.js'));

check(
  'Static import of PrimusZKTLS',
  main.includes('import') &&
    main.includes('PrimusZKTLS') &&
    main.includes('zktls-js-sdk'),
  'Use: import { PrimusZKTLS } from "@primuslabs/zktls-js-sdk" — never dynamic import()'
);

check(
  'No dynamic import() of SDK',
  !main.includes("import('@primuslabs/zktls-js-sdk") &&
    !main.includes('import("@primuslabs/zktls-js-sdk'),
  'Dynamic import of zktls-js-sdk will fail. Use static import at the top of the file.'
);

check(
  'init() is called',
  main.includes('.init('),
  'Call await primusZKTLS.init(appId, appSecret) before any other SDK method.'
);

check(
  'generateRequestParams() is called',
  main.includes('generateRequestParams('),
  'Must call primusZKTLS.generateRequestParams(templateId, userAddress)'
);

check(
  'toJsonString() is called on request',
  main.includes('.toJsonString()'),
  'Must call request.toJsonString() before signing.'
);

check(
  'sign() is called',
  main.includes('.sign('),
  'Must call primusZKTLS.sign(requestStr) to get signedRequestStr.'
);

check(
  'startAttestation() is called',
  main.includes('startAttestation('),
  'Must call primusZKTLS.startAttestation(signedRequestStr) to trigger the extension.'
);

// ── verifyAttestation ──────────────────────────────────────
//
// The verification result must be tied to the exact result returned
// by verifyAttestation(). Do not accept an unrelated `if (!x)`.
//
// Supported forms include:
//
//   const verifyResult = await primusZKTLS.verifyAttestation(attestation);
//   if (!verifyResult) { ... }
//
//   const verifyResult = await primusZKTLS.verifyAttestation(attestation);
//   if (verifyResult !== true) { ... }
//
//   const { verified } = await primusZKTLS.verifyAttestation(attestation);
//   if (!verified) { ... }
//
//   const { verified } = await primusZKTLS.verifyAttestation(attestation);
//   if (verified !== true) { ... }

const verifyAssignmentMatch = main.match(
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+primusZKTLS\.verifyAttestation\s*\(\s*attestation\s*\)\s*;?/
);

const verifyDestructuredMatch = main.match(
  /(?:const|let|var)\s*\{\s*([^}]+?)\s*\}\s*=\s*await\s+primusZKTLS\.verifyAttestation\s*\(\s*attestation\s*\)\s*;?/
);

check(
  'verifyAttestation() is called',
  Boolean(
    verifyAssignmentMatch ||
    verifyDestructuredMatch
  ),
  'Must call primusZKTLS.verifyAttestation(attestation) and use its result before business logic.'
);

let verifyResultChecked = false;

if (verifyAssignmentMatch) {
  const verifyVar = verifyAssignmentMatch[1];

  const escapedVar = verifyVar.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  // Only inspect code AFTER the exact verifyAttestation assignment.
  // This prevents an unrelated `if (!x)` elsewhere in the file
  // from satisfying the check.
  const afterVerify = main.slice(
    verifyAssignmentMatch.index +
      verifyAssignmentMatch[0].length
  );

  const checkPatterns = [
    new RegExp(
      `if\\s*\\(\\s*!\\s*${escapedVar}\\b`
    ),

    new RegExp(
      `if\\s*\\(\\s*${escapedVar}\\s*!==\\s*true\\b`
    ),

    new RegExp(
      `if\\s*\\(\\s*${escapedVar}\\s*===\\s*false\\b`
    ),

    new RegExp(
      `if\\s*\\(\\s*${escapedVar}\\s*===\\s*true\\b`
    ),

    new RegExp(
      `if\\s*\\(\\s*${escapedVar}\\s*!=\\s*true\\b`
    ),

    new RegExp(
      `if\\s*\\(\\s*${escapedVar}\\s*==\\s*false\\b`
    )
  ];

  verifyResultChecked = checkPatterns.some(
    (pattern) => pattern.test(afterVerify)
  );
}

if (verifyDestructuredMatch) {
  const destructuredNames =
    verifyDestructuredMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name] = part.split(':').map((x) => x.trim());
        return name.replace(/\s*=.*$/, '').trim();
      })
      .filter(Boolean);

  const afterVerify =
    main.slice(
      verifyDestructuredMatch.index +
        verifyDestructuredMatch[0].length
    );

  verifyResultChecked =
    destructuredNames.some((name) => {
      const escapedName = name.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const patterns = [
        new RegExp(
          `if\\s*\\(\\s*!\\s*${escapedName}\\b`
        ),

        new RegExp(
          `if\\s*\\(\\s*${escapedName}\\s*!==\\s*true\\b`
        ),

        new RegExp(
          `if\\s*\\(\\s*${escapedName}\\s*===\\s*false\\b`
        ),

        new RegExp(
          `if\\s*\\(\\s*${escapedName}\\s*===\\s*true\\b`
        ),

        new RegExp(
          `if\\s*\\(\\s*${escapedName}\\s*!=\\s*true\\b`
        ),

        new RegExp(
          `if\\s*\\(\\s*${escapedName}\\s*==\\s*false\\b`
        )
      ];

      return patterns.some(
        (pattern) => pattern.test(afterVerify)
      );
    });
}

check(
  'verifyAttestation result is checked',
  verifyResultChecked,
  'The result returned by verifyAttestation() must be checked before business logic.'
);

// ── Attestation data ───────────────────────────────────────

check(
  'attestation.data is parsed',
  main.includes('JSON.parse') &&
    (
      main.includes('attestation.data') ||
      main.includes('.data')
    ),
  'attestation.data is a stringified JSON string. Always try { JSON.parse(attestation.data) } catch (_) {}'
);

// ── Security ───────────────────────────────────────────────

check(
  'No appSecret hardcoded in obvious var name (prod check)',
  !(
    main.toLowerCase().includes('appsecret') &&
    main.includes('process.env') === false &&
    (
      main.includes('http://') ||
      main.includes('https://')
    )
  ),
  'WARNING: appSecret may be exposed in a publicly deployed frontend. Move signing to a backend for production.'
);

// ── Attestation mode ───────────────────────────────────────

check(
  'setAttMode uses algorithmType key (not attMode)',
  !main.includes('attMode:') ||
    main.includes('algorithmType'),
  'In zktls-js-sdk, mode is set via request.setAttMode({ algorithmType: "proxytls" }), not attMode: "..." directly.'
);

// ── DOM refs ────────────────────────────────────────────────

const firstDomRef = main.indexOf('getElementById');
const firstFunction = main.indexOf('function ');
const firstListener = main.indexOf('addEventListener');

check(
  'DOM refs declared before functions that use them',
  firstDomRef !== -1 &&
    (
      firstListener === -1 ||
      firstDomRef < firstListener
    ) &&
    (
      firstFunction === -1 ||
      firstDomRef < firstFunction
    ),
  'Declare all DOM refs (getElementById) before defining functions that reference them to avoid temporal dead zone errors.'
);

// ── SKILL.md ───────────────────────────────────────────────

console.log('\n[ SKILL.md ]');

const skill =
  readFile(abs('SKILL.md')) ||
  readFile(abs('../SKILL.md')) ||
  readFile(abs('../../SKILL.md'));

check(
  'SKILL.md is present',
  skill.length > 0
);

check(
  'Documents test vs production distinction',
  skill.includes('Test Mode') &&
    skill.includes('Production Mode'),
  'SKILL.md must explain the appSecret / signing architecture difference.'
);

check(
  'Documents verifyAttestation requirement',
  skill.includes('verifyAttestation'),
  'SKILL.md must document that verifyAttestation() must always be called.'
);

check(
  'References error-codes.md',
  skill.includes('error-codes'),
  'SKILL.md should reference the error-codes reference file.'
);

// ── Summary ────────────────────────────────────────────────

console.log('\n─────────────────────────────────');
console.log(`  Passed: ${passed}   Failed: ${failed}`);

if (failed === 0) {
  console.log('\n  ✅ All checks passed. Ready to test.\n');
} else {
  console.log(`\n  ❌ ${failed} issue(s) found:\n`);

  errors.forEach((e) => console.log(`     • ${e}`));

  console.log('');
  process.exit(1);
}