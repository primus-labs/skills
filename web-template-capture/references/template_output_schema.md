# Template Output Schema

`emit_template.mjs` should produce a template draft in this format:

```json
{
  "name": "twitterusername-mcp",
  "description": "Extracts the logged-in Twitter username from the account settings endpoint.",
  "category": "OTHER",
  "status": "AVAILABLE",
  "dataSource": "twitter",
  "testResult": "SUCCESS",
  "templatePrivate": true,
  "dataPageTemplate": "{\"baseUrl\":\"https://x.com/settings/account\"}",
  "dataSourceTemplate": "[{\"requestTemplate\":{\"host\":\"api.x.com\",\"targetUrlExpression\":\"https://api.x.com/1.1/account/settings.json(?:\\\\?.*)?\",\"targetUrlType\":\"REGX\",\"ext\":{},\"dynamicParamters\":[],\"method\":\"GET\"},\"responseTemplate\":[{\"resolver\":{\"type\":\"JSON_PATH\",\"expression\":\"$.screen_name\"},\"valueType\":\"FIXED_VALUE\",\"fieldType\":\"FIELD_REVEAL\",\"feilds\":[{\"fieldName\":\"username\",\"showName\":\"Username\",\"key\":\"screen_name\",\"DataType\":\"string\"}]}]}]"
}
```

Rules:

- `name` is the template name.
- `description` is the detailed description of the template.
- `dataPageTemplate` is a JSON string. Its `baseUrl` must be the page URL where the selected interface request was observed, or the HTML page URL where the selected field was rendered.
- `dataSourceTemplate` is a JSON string. It stores an array of request/response template objects.
- `status` must always be `AVAILABLE`.
- `testResult` must always be `SUCCESS`.
- `requestTemplate.host` should be the host portion of the selected request URL, such as `api.x.com`.
- `dataPageTemplate.baseUrl` is the interface-or-HTML page address. It is not the API request URL itself.
- `requestTemplate.targetUrlExpression` must be a regular expression string that matches the request URL carrying the target data.
- `requestTemplate.targetUrlType` should be `REGX`.
- `requestTemplate.ext` should default to `{}`.
- `requestTemplate.dynamicParamters` should default to `[]` unless the caller needs dynamic extraction rules.
- `requestTemplate.method` must be the observed request method.
- For JSON responses, use `resolver.type` = `JSON_PATH`.
- If the target data comes from HTML, `responseTemplate.resolver.expression` must be an XPath expression.
- Otherwise, `responseTemplate.resolver.expression` must be a JSON path expression.
- `resolver.type` remains `JSON_PATH` even when `resolver.expression` contains XPath for HTML-derived fields.
- `valueType` must always be `FIXED_VALUE`.
- `fieldType` must always be `FIELD_REVEAL`.
- Preserve the downstream key spelling `feilds`.
- `feilds[].fieldName`, `feilds[].showName`, `feilds[].key`, and `feilds[].DataType` should be filled with the discovered field metadata when available.
- `dataSourceTemplate` should describe the selected endpoint template. If a single endpoint yields multiple desired fields, keep them together in the same `responseTemplate` array.
- If desired fields come from different endpoints, emit multiple top-level objects inside the `dataSourceTemplate` array, one per endpoint.
- `baseUrl` should use the actual page URL where the request was triggered or the HTML was rendered, not just the original site entry URL, when the selected evidence was observed on a later page.
- `targetUrlExpression` should be regex-safe. Escape literal `?` and other regex-sensitive characters, and allow optional query strings when appropriate.
