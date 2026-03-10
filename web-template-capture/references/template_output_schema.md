# Template Output Schema

`emit_template.mjs` produces a normalized JSON draft with these fields:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "selected_candidate_index": 0,
  "target": {
    "field_name": "string",
    "field_type": "string",
    "hint_value": "string or null",
    "ownership_mode": "string"
  },
  "source": {
    "source_type": "network_json or html_dom",
    "source_url": "string",
    "entry_url": "string or null",
    "request_method": "string or null",
    "request_url_pattern": "string or null",
    "operation_name": "string or null"
  },
  "field": {
    "json_path": "string or null",
    "dom_selector": "string or null",
    "dom_xpath": "string or null",
    "dom_item_xpath": "string or null",
    "value_attribute": "string or null",
    "sample_value": "any"
  },
  "stability": {
    "score": 0,
    "reasons": []
  },
  "alternatives": [
    {
      "index": 1,
      "source_url": "string or null",
      "request_method": "string or null",
      "request_url_pattern": "string or null",
      "operation_name": "string or null",
      "json_path": "string or null",
      "dom_selector": "string or null",
      "dom_xpath": "string or null",
      "dom_item_xpath": "string or null",
      "value_attribute": "string or null",
      "sample_value": "any",
      "score": 0,
      "why_not_top": []
    }
  ],
  "notes": []
}
```

`source.source_url` is the page URL that actually triggered or exposed the selected request or DOM evidence. `source.entry_url` preserves the first URL opened by the capture script.
`selected_candidate_index` lets callers map the draft back to `candidate-report.json`. `alternatives` provides compact summaries of the next-best candidates without replacing the default single selected template.

For GraphQL requests, `request_url_pattern` should generalize the hash segment into `*` and keep the operation name stable.
For HTML-only matches, `request_method` should be `GET`, `request_url_pattern` should be the page document URL, and `field.dom_xpath` should identify the rendered element or list.
For list-like HTML fields, prefer `field.dom_xpath` as the full list XPath, `field.dom_item_xpath` as the repeated item pattern when available, and `field.value_attribute` to specify whether extraction should read `href`, `text`, or another node attribute.
