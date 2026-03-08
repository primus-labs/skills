---
name: web-template-capture
description: Prepare template drafts for browser-based websites by opening the site in Playwright, letting the user log in manually, capturing network and DOM data, ranking candidate fields for any target value, and emitting a reusable template draft. Use when the user wants to create a template for a website, prove current-account ownership, or discover request URLs and JSON paths behind a page.
---

# Web Template Capture

Use this skill when the user wants a template for any browser-visible field such as username, email, balance, membership tier, order number, KYC status, or page-specific records.

This skill is intentionally scoped to websites that can be explored in a browser and expose useful data through XHR or `fetch`, or at least render the value in the DOM. It is not a promise that every site can be automated end to end.

## Inputs

Collect these inputs before running scripts:

- `site_url`: the first page to open
- `target_field_name`: human name such as `username`, `email`, `balance`, `tier`
- `target_field_type`: `string`, `number`, `boolean`, or `date`
- `target_hint_value`: optional sample value if the user already knows it
- `target_keywords`: optional extra phrases such as `30天, 交易量, BTC成交量, 费率等级`
- `navigation_hint`: where the user should navigate after login
- `ownership_mode`: `current_user`, `page_subject`, or `any_visible_record`

Known sample values make the ranking much stronger. If the user does not know the value, fall back to semantic matching on keys and URL patterns.

## Workflow

1. Run `scripts/capture_site.mjs` to open a persistent Chrome window and capture responses plus DOM snapshots.
2. If the field is hidden behind a tab, accordion, or clickable card, prefer target-aware auto-exploration with `--auto-explore`, `--target-field-name`, and `--target-keywords`.
3. Let the user log in manually, navigate to the page containing the target field, then close the browser window. If auto-explore is enabled, the script can close on its own after click exploration finishes, but if it detects a login page it should pause exploration and wait for manual login instead of auto-closing.
4. Run `scripts/find_candidates.mjs` against the saved session.
5. If the top candidates are ambiguous, read [references/ranking_rules.md](references/ranking_rules.md) and prefer the most direct data source.
6. Run `scripts/emit_template.mjs` to generate a template draft from the candidate report.
7. Present the top 1-3 candidates, explain why the highest-ranked source is preferred, and state any instability risks.

When presenting or emitting a template, treat `Source URL` as the page URL that actually triggered the chosen request. Keep the original `site_url` only as the entry URL for the capture session.

## Selection Rules

- Prefer current-account endpoints such as `viewer`, `me`, `account`, `settings`, or similar when the goal is to prove the logged-in user.
- Next prefer single-object detail endpoints for the current page subject.
- Prefer shallow JSON paths over deeply nested timeline or recommendation paths.
- Prefer endpoints whose URL or operation name semantically matches the target field or entity.
- Do not treat GraphQL hash segments as stable. Match on operation name or path suffix instead.
- Treat DOM-only matches as a fallback and label them clearly as less stable than direct network data.

## Script Usage

Capture:

```bash
node web-template-capture/scripts/capture_site.mjs \
  --site-url https://x.com/home \
  --target-field-name username \
  --navigation-hint "Log in, then open the page containing the target field."
```

Capture with automatic click exploration:

```bash
node web-template-capture/scripts/capture_site.mjs \
  --site-url https://example.com/app \
  --auto-explore \
  --target-field-name "30天交易量" \
  --target-keywords "30天,交易量,成交量,BTC成交量,费率等级,VIP" \
  --login-wait-ms 600000 \
  --max-clicks 8 \
  --settle-ms 2500 \
  --navigation-hint "Log in if needed. The script will click visible controls to discover the request."
```

Analyze:

```bash
node web-template-capture/scripts/find_candidates.mjs \
  --session artifacts/x_com/<session-id> \
  --field-name username \
  --field-type string \
  --hint-value wenjun_yuan1 \
  --ownership-mode current_user
```

Emit template draft:

```bash
node web-template-capture/scripts/emit_template.mjs \
  --report artifacts/x_com/<session-id>/candidate-report.json
```

Emit a specific candidate or include more backup summaries:

```bash
node web-template-capture/scripts/emit_template.mjs \
  --report artifacts/x_com/<session-id>/candidate-report.json \
  --index 1 \
  --alternatives 5
```

## Outputs

The scripts emit:

- `session.json`: high-level capture metadata
- `responses/`: captured network payloads
- `dom/`: DOM snapshots
- `interactions`: per-click action records with response deltas in `session.json`
- `candidate-report.json`: ranked field candidates
- `template-draft.json`: normalized template draft with the selected candidate plus alternative summaries

If a site is heavily protected, only uses HTML, or relies on WebSocket or protobuf data, say that explicitly and stop short of claiming a stable template exists.
