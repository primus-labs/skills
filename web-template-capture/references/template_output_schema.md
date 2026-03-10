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
  "dataPageTemplate": "{\"baseUrl\":\"https://twitter.com\"}",
  "dataSourceTemplate": "[{\"requestTemplate\":{\"targetUrlExpression\":\"https://api.x.com/1.1/account/settings.json.*\",\"targetUrlType\":\"REGX\",\"ext\":{},\"dynamicParamters\":[],\"method\":\"GET\"},\"responseTemplate\":[{\"resolver\":{\"type\":\"JSON_PATH\",\"expression\":\"$.screen_name\"},\"valueType\":\"FIXED_VALUE\",\"fieldType\":\"FIELD_REVEAL\",\"feilds\":[{\"fieldName\":\"\",\"showName\":\"\",\"key\":\"screen_name\",\"DataType\":\"string\"}]}]}]"
}
```

Rules:

- `name` is the template name.
- `description` is the detailed description of the template.
- `dataPageTemplate` is a JSON string. Its `baseUrl` must be the page URL where the selected data source was observed.
- `dataSourceTemplate` is a JSON string. It stores the request matching rule and the target field extraction expression.
- `status` must always be `AVAILABLE`.
- `testResult` must always be `SUCCESS`.
- `requestTemplate.targetUrlExpression` must be a regular expression string that matches the request URL carrying the target data.
- `requestTemplate.targetUrlType` should be `REGX`.
- For JSON responses, use `resolver.type` = `JSON_PATH` and do not include `requestTemplate.ignoreResponse`.
- If the target data comes from HTML, `responseTemplate.resolver.expression` must be an XPath expression.
- Otherwise, `responseTemplate.resolver.expression` must be a JSON path expression.
- For HTML-derived extraction, `requestTemplate` must include `"ignoreResponse": false`.
- `dataSourceTemplate` should describe only the selected target-field source, not all alternatives.
- `baseUrl` should use the actual page URL, not just the original site entry URL, when the selected evidence was observed on a later page.
