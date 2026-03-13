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
