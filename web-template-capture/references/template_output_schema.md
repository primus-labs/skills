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
    "source_type": "network_json or dom",
    "source_url": "string",
    "entry_url": "string or null",
    "request_method": "string or null",
    "request_url_pattern": "string or null",
    "operation_name": "string or null"
  },
  "field": {
    "json_path": "string or null",
    "dom_selector": "string or null",
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
