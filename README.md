# template-bot

Browser-driven template discovery for sites that expose useful data through XHR or `fetch`.

This repository currently includes the `web-template-capture` skill. It opens a site in Playwright, waits only for manual login when needed, then explores the site automatically, captures network responses and DOM snapshots, ranks likely request/field candidates, and emits a template draft.

## Requirements

- Node.js 18+
- Google Chrome installed locally
- A Codex-compatible AI IDE if you want to invoke the skill by name

## Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/primus-labs/template-bot.git
cd template-bot
npm install
```

## Install The Skill In Codex

If you want to call the skill from Codex or another compatible AI IDE, copy the skill folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R web-template-capture ~/.codex/skills/web-template-capture
```

After that, restart the IDE or open a new chat so the skill is discovered.

## Run Without The IDE

You can also run the scripts directly from the repository.

Capture a browsing session:

```bash
npm run capture:site -- \
  --site-url https://x.com/home \
  --target-field-name username \
  --navigation-hint "Log in if needed, then wait while the script explores automatically."
```

Analyze candidates:

```bash
npm run find:candidates -- \
  --session artifacts/x_com/<session-id> \
  --field-name username \
  --field-type string \
  --hint-value wenjun_yuan1 \
  --ownership-mode current_user
```

Emit a template draft:

```bash
npm run emit:template -- \
  --report artifacts/x_com/<session-id>/candidate-report.json
```

## Run Through The Skill

After installing the skill into `~/.codex/skills`, you can invoke it in Codex with a prompt like:

```text
使用 Web Template Capture 帮我为 https://www.binance.com/zh-CN/my/dashboard 创建模版，目标字段是30天交易量
```

Or:

```text
Use $web-template-capture to prepare a template for https://x.com/home.
The target field is the logged-in username.
```

## Notes

- `artifacts/` contains captured responses and DOM snapshots and is ignored by Git.
- The capture script uses a persistent browser profile so login state can be reused.
- Auto-exploration is the default mode. If the script detects a login page, it pauses and waits for manual login instead of closing immediately.
- Use `--manual-capture` only if you want to drive the browser yourself after login.
- Some sites still require manual judgment. The top-ranked candidate is a recommendation, not a guarantee.
