import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponseTemplateEntry,
  normalizeHtmlResolverExpression
} from "./emit_template.mjs";

test("normalizeHtmlResolverExpression appends a question mark for html expressions", () => {
  assert.equal(normalizeHtmlResolverExpression("//div[@id='profile']"), "//div[@id='profile']?");
});

test("normalizeHtmlResolverExpression preserves an existing trailing question mark", () => {
  assert.equal(normalizeHtmlResolverExpression("//div[@id='profile']?"), "//div[@id='profile']?");
});

test("buildResponseTemplateEntry appends a question mark for html-only candidates", () => {
  const entry = buildResponseTemplateEntry({
    target: {
      field_name: "username",
      field_type: "string"
    }
  }, {
    source_type: "document_html",
    html_xpath: "//*[@id=\"profile-name\"]"
  });

  assert.equal(entry.resolver.expression, "//*[@id=\"profile-name\"]?");
});

test("buildResponseTemplateEntry leaves json paths unchanged", () => {
  const entry = buildResponseTemplateEntry({
    target: {
      field_name: "username",
      field_type: "string"
    }
  }, {
    source_type: "network_json",
    json_path: "$.profile.username"
  });

  assert.equal(entry.resolver.expression, "$.profile.username");
});
