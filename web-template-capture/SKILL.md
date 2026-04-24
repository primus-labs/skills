---
name: web-template-capture
description: Prepare template drafts for browser-based websites by opening the site in Playwright, waiting only for manual login when needed, then automatically exploring pages, capturing network and DOM data, ranking candidate fields for any target value, and emitting a reusable template draft. Use when the user wants to create a template for a website, prove current-account ownership, or discover request URLs and JSON paths behind a page.
---

# Web Template Capture

Use this skill when the user wants a template for any browser-visible field such as username, email, balance, membership tier, order number, KYC status, or page-specific records and lists.

This skill is intentionally scoped to websites that can be explored in a browser and expose useful data through XHR or `fetch`, or at least render the value in the DOM. If the field only exists in rendered HTML, emit the page HTML request URL and the matching DOM XPath instead of pretending a JSON API exists. It is not a promise that every site can be automated end to end.

When the user needs multiple target values, treat them as one capture set. The final answer must only use candidates that were observed during the same page load or the same stable page state, so the returned template can be resolved together for one visit. Do not mix fields captured from unrelated navigations, different records, or different moments in the session unless the user explicitly allows a multi-page workflow.

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

If the user needs more than one value, normalize the request into a `target_fields` list. Each item should include:

- `field_name`
- `field_type`
- `hint_value`: optional
- `keywords`: optional
- `field_description`: the human-readable label that should appear in the final template output

For multi-field requests, confirm whether all values are expected to appear on one page. Default to `same_page_required: true`.

Known sample values make the ranking much stronger. If the user does not know the value, fall back to semantic matching on keys and URL patterns.

## Workflow

0. If the skill package has not been prepared yet, run `npm run setup` from the `web-template-capture` directory. If a user reports startup or browser issues, run `npm run doctor` there before retrying.
1. Run `scripts/capture_site.mjs` to open a persistent Chrome window and capture responses plus DOM snapshots.
2. By default, `scripts/capture_site.mjs` should run in target-aware auto-exploration mode. The user should only need to log in manually if required.
3. After login, do not ask the user to navigate further unless the site blocks automation. The script should continue exploring likely tabs, cards, and detail links on its own. If it detects a login page it should pause exploration and wait for manual login, then resume automatically.
4. For multi-field requests, identify a single page load, stable route, or interaction step where all requested values are present together. Only rank candidates from that shared capture context.
5. Run `scripts/find_candidates.mjs` against the saved session.
6. If the top candidates are ambiguous, read [references/ranking_rules.md](references/ranking_rules.md) and prefer the most direct data source.
7. Run `scripts/emit_template.mjs` to generate a template draft from the candidate report.
8. Present the top 1-3 candidates, explain why the highest-ranked source is preferred, and state any instability risks.

When presenting or emitting a template, treat `Source URL` as the page URL that actually triggered the chosen request. Keep the original `site_url` only as the entry URL for the capture session.

For multi-field captures, also record the shared `Page URL` or interaction step that produced the full set. If one requested field is only available on another page load, mark the set as not jointly capturable instead of silently merging unrelated sources.

Treat the browser address bar as public routing state, not as a valid data source. If the target value only appears because it is embedded in the page URL, query string, or hash fragment shown in the browser address bar, reject that candidate and continue looking for a network payload or rendered DOM field that exposes the value independently of the address bar.

## Selection Rules

- Prefer current-account endpoints such as `viewer`, `me`, `account`, `settings`, or similar when the goal is to prove the logged-in user.
- Next prefer single-object detail endpoints for the current page subject.
- Prefer shallow JSON paths over deeply nested timeline or recommendation paths.
- Prefer endpoints whose URL or operation name semantically matches the target field or entity.
- Do not treat GraphQL hash segments as stable. Match on operation name or path suffix instead.
- When multiple fields are requested, prefer a set of endpoints that all fire during the same page load or stable page state. If field A appears on `api1` and field B appears on `api2`, both are valid only if both requests belong to that same captured page state.
- For multi-endpoint answers, return each endpoint separately with its own field description and JSONPath. Example: `screen_name -> $.screen_name` from `api1`, and `user id -> $.profile.user.id` from `api2`.
- Reject any candidate whose target sample value appears directly in the browser address bar URL, including the path, query string, or hash.
- Treat DOM-only matches as a fallback and label them clearly as less stable than direct network data.
- For HTML-only matches, set the request URL to the page's document URL and include the DOM XPath that exposed the value.
- For HTML-only multi-field answers, return one field entry per target value with its own field description and XPath, but only if all XPaths come from the same page load or stable page state.
- Prefer robust XPath expressions that anchor on stable attributes such as `id`, `data-*`, `aria-*`, `name`, or distinctive class combinations. Prefer forms like `//div[@id="cardRoot"]/div[1]/h1` over brittle absolute roots such as `/html/div/div/h1`.
- Use absolute-root XPath only as a last resort. If no stable anchor exists, call out the fragility explicitly in the risks section.
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
- `dom/`: DOM snapshots plus metadata with visible-node XPath catalog
- `interactions`: per-click action records with response deltas in `session.json`
- `candidate-report.json`: ranked field candidates
- `template-draft.json`: final template object ready for downstream use, and it must include both `dataPageTemplate` and `dataSourceTemplate`

Inside `template-draft.json`, `dataPageTemplate` must be a JSON string whose `baseUrl` is the page where the selected network request was triggered, or the page where the selected HTML field was rendered. This is the interface-or-HTML page address, not the API URL itself.

Inside `template-draft.json`, `dataSourceTemplate` should be a JSON string convertible into this normalized structure:

```json
[
  {
    "requestTemplate": {
      "host": "api.x.com",
      "targetUrlExpression": "https://api.x.com/1.1/account/settings.json\\?.*",
      "targetUrlType": "REGX",
      "ext": {},
      "dynamicParamters": [],
      "method": "GET"
    },
    "responseTemplate": [
      {
        "resolver": {
          "type": "JSON_PATH",
          "expression": "$.screen_name"
        },
        "valueType": "FIXED_VALUE",
        "fieldType": "FIELD_REVEAL",
        "feilds": [
          {
            "fieldName": "",
            "showName": "",
            "key": "screen_name",
            "DataType": "string"
          }
        ]
      }
    ]
  }
]
```

Interpret this schema as follows:

- `dataPageTemplate.baseUrl`: the page URL where the selected interface request was observed, or the HTML page URL where the selected field was rendered
- `requestTemplate.host`: the request host such as `api.x.com`
- `requestTemplate.targetUrlExpression`: the target request URL expressed as a regular expression
- `requestTemplate.targetUrlType`: always `REGX`
- `requestTemplate.ext`: default to `{}`
- `requestTemplate.dynamicParamters`: default to `[]` unless the user explicitly needs dynamic extraction rules
- `requestTemplate.method`: the actual HTTP method such as `GET` or `POST`
- If the target data is HTML-only, set `requestTemplate.ignoreResponse` to `true`.
- Do not include `requestTemplate.ignoreResponse` for normal network-backed JSON responses.
- `responseTemplate`: an array because one URL may expose multiple target values
- `responseTemplate[].resolver.type`: always `JSON_PATH`
- `responseTemplate[].resolver.expression`: use JSONPath when the source is JSON, and XPath when the source is HTML
- `responseTemplate[].valueType`: always `FIXED_VALUE`
- `responseTemplate[].fieldType`: always `FIELD_REVEAL`
- `responseTemplate[].feilds`: populate from the actual discovered field metadata and preserve this key spelling exactly if the downstream format expects it

For multi-field captures, `candidate-report.json` and `template-draft.json` should group results by requested field and shared capture context. Each field entry should include:

- `field_description`
- `source_type`: `network` or `dom`
- `request_url` or `document_url`
- `json_path` for network-backed fields, or `dom_xpath` for HTML-backed fields
- `page_url`: the page that triggered or rendered the value

When emitting the final request/response template:

- Always return both `dataPageTemplate` and `dataSourceTemplate`.
- Set `dataPageTemplate.baseUrl` to the page that triggered the chosen request. Do not use the request URL itself as `baseUrl`.
- For HTML-only matches, set `dataPageTemplate.baseUrl` to the document page URL where the XPath was observed.
- For HTML-only matches, set `requestTemplate.ignoreResponse` to `true`.
- Group fields under the same object when they come from the same matched URL pattern and HTTP method.
- If two requested fields come from different endpoints, emit two objects in the top-level array, one per endpoint.
- For JSON responses, set `resolver.expression` to the exact JSONPath such as `$.screen_name` or `$.profile.user.id`.
- For HTML responses, still set `resolver.type` to `JSON_PATH`, but put the XPath into `resolver.expression` exactly as requested by the user.
- Use the captured request URL to derive `host` and a regex-style `targetUrlExpression`.
- Escape literal `?` and other regex-sensitive characters in `targetUrlExpression` so the expression is a valid regex, not a plain URL string.
- Keep `method` equal to the observed request method from the browser capture.

For network-backed multi-field outputs, return one field mapping per discovered endpoint. Example:

- `screen name`: request `https://api.x.com/api1`, JSONPath `$.screen_name`
- `user id`: request `https://api.x.com/api2`, JSONPath `$.profile.user.id`

For list-like HTML fields, `template-draft.json` should prefer:

- a list XPath in `field.dom_xpath`
- an item pattern in `field.dom_item_xpath` when available
- a `field.value_attribute` such as `href` or `text`
- `sample_value` as an array of example extracted values

If a site is heavily protected, only uses HTML, or relies on WebSocket or protobuf data, say that explicitly. For HTML-only matches, return the document URL and DOM XPath in the same request/response template shape; if even that is ambiguous, stop short of claiming a stable template exists.

For HTML-only matches, ensure the XPath is as stable as practical. Prefer attribute-anchored selectors and avoid brittle full-document ancestry unless no better option exists.

## Default Behavior

- Treat auto-exploration as the default mode.
- Ask the user only to complete login or captcha steps that cannot be automated safely.
- Use `--manual-capture` only when the user explicitly wants to drive navigation themselves or when automated exploration is clearly unsafe.
