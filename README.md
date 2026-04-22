# Primus Skills

A repository of installable skills for Codex, Cursor, Claude Code, and compatible AI IDEs.

Each skill should be self-contained when possible. Runtime dependencies, setup scripts, and troubleshooting commands should live inside the skill directory rather than the repository root.

## Install A Skill

If your IDE supports prompt-based skill installation, use:

```text
Set up the <skill_name> skill from https://github.com/primus-labs/skills.git, install its dependencies, and verify it with the doctor script.
```

If local fallback setup is needed:

```bash
git clone https://github.com/primus-labs/template-bot.git
cd template-bot/<skill-folder>
npm run setup
npm run doctor
```

## Skills

| Skill | Description | Path | Runtime | Use prompt |
| --- | --- | --- | --- | --- |
| `primus-network-core-sdk` | Build backend/server-side Node.js programs using `@primuslabs/network-core-sdk`. No browser extension or user interaction required. Supports privacy ops, multiple URLs, mTLS, and DVC/zkVM workflow. | `primus-network-core-sdk/` | Node.js (Backend) | `Use the primus-network-core-sdk skill to build a program that proves <what_to_prove>. The requests are <url_list>. My wallet private key is <privatekey>. Chain: <chain>.` |
| `primus-network-js-sdk-dapp` | Scaffold a DApp using `@primuslabs/network-js-sdk` (decentralized zkTLS). Requires wallet + gas for on-chain task submission. Default to Base Sepolia for dev, Base mainnet for production. | `primus-network-js-sdk-dapp/` | Node.js + Vite | `Use the primus-network-js-sdk-dapp skill to scaffold a DApp that proves <what_to_prove>. The template ID is <template_id>.` |
| `primus-zktls-js-sdk-dapp` | Build frontend DApps using `@primuslabs/zktls-js-sdk` (enterprise zkTLS). Supports test mode (frontend signing) and production mode (backend signing). No wallet/gas required for attestation generation. | `primus-zktls-js-sdk-dapp/` | Node.js + Vite | `Use the primus-zktls-js-sdk-dapp skill to scaffold a DApp that proves <what_to_prove>. The template ID is <template_id>. My appId is <app_id>.` |
| `onchainos-verifiable-skills` | OKX OnchainOS API calls adapted into verifiable flows using `primus-zktls-core-sdk`. Includes DEX market/token, wallet portfolio, swap, and gateway endpoints with runnable demos. | `onchainos-verifiable-skills/` | Node.js | `Use OnchainOS Verifiable Skills to prove <endpoint_type> data from OKX OnchainOS with zkTLS attestation.` |
| `binance-verifiable-skills` | Binance Skills Hub API calls adapted into verifiable flows using `primus-zktls-core-sdk`. Includes first-release Spot, Margin Trading, USDS Futures, and Alpha demos plus shared Binance signing helpers. | `binance-verifiable-skills/` | Node.js | `Use Binance Verifiable Skills to prove a Binance Spot, Margin, Futures, or Alpha API response with zkTLS attestation.` |
| `primus-zktls-core-sdk` | Integration guide for Primus zkTLS Core SDK, including SDK calls, attestation generation, local verification, and Solidity on-chain verification with `zktls-contracts`. | `primus-zktls-core-sdk/` | Node.js | `Use Primus zkTLS Core SDK to explain how to build a request, generate an attestation, and verify it on-chain.` |
| `web-template-capture` | Browser-driven template discovery for fields exposed through network responses or rendered DOM. | `web-template-capture/` | Node.js + Playwright | `Use Web Template Capture to prepare a template for <site_url>. The target field is <field_name>. The known sample value is <sample_value>.` |

Each skill directory is expected to contain its own `SKILL.md`. If the skill has runtime dependencies, prefer keeping a local `package.json` inside that skill folder.

## Common Runtime Conventions

- Skill artifacts should default to user-level data directories, not repository directories.
- `web-template-capture` stores captured session data under `~/.web-template-capture/artifacts/`.
- Skills that need persistent browser state should store it outside the repository.
- Do not commit generated artifacts, browser profiles, or session data.

## Repository Conventions

- Keep the repository root lightweight and skill-agnostic.
- Put user-facing workflow details inside each skill directory.
- Prefer `setup` and `doctor` scripts for skills with external dependencies.
- Keep root documentation focused on discovery, installation, and shared conventions.

## Contributing

When adding a new skill:

1. Create a dedicated skill directory.
2. Add a `SKILL.md` with clear trigger and workflow instructions.
3. Add self-contained setup and diagnostics when the skill depends on external runtimes or tools.
4. Update the Skills table in this README.
