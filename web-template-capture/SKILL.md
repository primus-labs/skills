---
name: web-template-capture
description: Prepare template drafts for browser-based websites by opening the site in Playwright, waiting only for manual login when needed, then automatically exploring pages, capturing network and DOM data, ranking candidate fields for any target value, and emitting a reusable template draft. Use when the user wants to create a template for a website, prove current-account ownership, or discover request URLs and JSON paths behind a page.
---

# Web Template Capture

Use this skill when the user wants a template for any browser-visible field such as username, email, balance, membership tier, order number, KYC status, or page-specific records and lists.

This skill is intentionally scoped to websites that can be explored in a browser and expose useful data through XHR or `fetch`, or at least render the value in the DOM. If the field only exists in rendered HTML, emit the page HTML request URL and the matching DOM XPath instead of pretending a JSON API exists. It is not a promise that every site can be automated end to end.

If the user asks to install this skill in Codex, Cursor, Claude Code, or another compatible IDE, treat installation as:

1. Copy or install the `web-template-capture` folder into the IDE's skill directory.
2. Run `npm run setup` inside the installed skill directory.
3. If setup was already run before or the user reports issues, run `npm run doctor`.
4. Tell the user to open a new chat or reload the IDE only after setup succeeds.

## Inputs

Collect these inputs before running scripts:

- `site_url`: the first page to open
- `target_field_name`: human name such as `username`, `email`, `balance`, `tier`
- `target_field_type`: `string`, `number`, `boolean`, or `date`
- `target_hint_value`: optional sample value if the user already knows it
- `target_keywords`: optional extra phrases such as `30-day, trading volume, BTC trading volume, fee tier`
- `navigation_hint`: where the user should navigate after login
- `ownership_mode`: `current_user`, `page_subject`, or `any_visible_record`

Known sample values make the ranking much stronger. If the user does not know the value, fall back to semantic matching on keys and URL patterns.

## Workflow

0. If the skill package has not been prepared yet, run `npm run setup` from the `web-template-capture` directory. If a user reports startup or browser issues, run `npm run doctor` there before retrying.
1. Run `scripts/capture_site.mjs` to open a persistent Chrome window and capture responses plus DOM snapshots.
2. By default, `scripts/capture_site.mjs` should run in target-aware auto-exploration mode. The user should only need to log in manually if required.
3. After login, do not ask the user to navigate further unless the site blocks automation. The script should continue exploring likely tabs, cards, and detail links on its own. If it detects a login page it should pause exploration and wait for manual login, then resume automatically.
4. Run `scripts/find_candidates.mjs` against the saved session.
5. If the top candidates are ambiguous, read [references/ranking_rules.md](references/ranking_rules.md) and prefer the most direct data source.
6. Run `scripts/emit_template.mjs` to generate a template draft from the candidate report.
7. When the page exposes a tab icon or favicon, carry it through to the final template output as `websiteIcon`.
8. Present the top 1-3 candidates, explain why the highest-ranked source is preferred, and state any instability risks.

When presenting or emitting a template, treat `Source URL` as the page URL that actually triggered the chosen request. Keep the original `site_url` only as the entry URL for the capture session.

## Selection Rules

- Prefer current-account endpoints such as `viewer`, `me`, `account`, `settings`, or similar when the goal is to prove the logged-in user.
- Next prefer single-object detail endpoints for the current page subject.
- Prefer shallow JSON paths over deeply nested timeline or recommendation paths.
- Prefer endpoints whose URL or operation name semantically matches the target field or entity.
- Do not treat GraphQL hash segments as stable. Match on operation name or path suffix instead.
- Treat DOM-only matches as a fallback and label them clearly as less stable than direct network data.
- For HTML-only matches, set the request URL to the page's document URL and include the DOM XPath that exposed the value.
- For list-like DOM fields such as connections, orders, followers, or transactions, prefer a repeated-node XPath for the full list plus the value attribute to read, rather than a single-node absolute XPath.

## Script Usage

First-time setup:

```bash
cd web-template-capture
npm run setup
```

Environment check:

```bash
cd web-template-capture
npm run doctor
```

Capture:

```bash
cd web-template-capture && node scripts/capture_site.mjs \
  --site-url https://x.com/home \
  --target-field-name username \
  --navigation-hint "Log in if needed, then wait while the script explores automatically."
```

Capture with the legacy manual mode:

```bash
cd web-template-capture && node scripts/capture_site.mjs \
  --site-url https://example.com/app \
  --manual-capture \
  --target-field-name "30-day trading volume" \
  --navigation-hint "Log in if needed, then navigate manually to the page containing the target field."
```

Analyze:

```bash
cd web-template-capture && node scripts/find_candidates.mjs \
  --session ~/.web-template-capture/artifacts/x_com/<session-id> \
  --field-name username \
  --field-type string \
  --hint-value wenjun_yuan1 \
  --ownership-mode current_user
```

Emit template draft:

```bash
cd web-template-capture && node scripts/emit_template.mjs \
  --report ~/.web-template-capture/artifacts/x_com/<session-id>/candidate-report.json
```

Emit a specific candidate or include more backup summaries:

```bash
cd web-template-capture && node scripts/emit_template.mjs \
  --report ~/.web-template-capture/artifacts/x_com/<session-id>/candidate-report.json \
  --index 1 \
  --alternatives 5
```

## Outputs

The scripts emit:

- `session.json`: high-level capture metadata
- `responses/`: captured network payloads
- `dom/`: DOM snapshots plus metadata with visible-node XPath catalog and the best detected page icon
- `interactions`: per-click action records with response deltas in `session.json`
- `candidate-report.json`: ranked field candidates plus page icon context when available
- `template-draft.json`: normalized template draft with the selected candidate plus alternative summaries and `websiteIcon`

For list-like HTML fields, `template-draft.json` should prefer:

- a list XPath in `field.dom_xpath`
- an item pattern in `field.dom_item_xpath` when available
- a `field.value_attribute` such as `href` or `text`
- `sample_value` as an array of example extracted values

If a site is heavily protected, only uses HTML, or relies on WebSocket or protobuf data, say that explicitly. For HTML-only matches, return the document URL and DOM XPath; if even that is ambiguous, stop short of claiming a stable template exists.

## Default Behavior

- Treat auto-exploration as the default mode.
- Ask the user only to complete login or captcha steps that cannot be automated safely.
- Use `--manual-capture` only when the user explicitly wants to drive navigation themselves or when automated exploration is clearly unsafe.
