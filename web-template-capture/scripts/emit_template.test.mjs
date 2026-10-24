import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponseTemplateEntry,
  inferDataSource,
  normalizeHtmlResolverExpression
} from "./emit_template.mjs";

test("inferDataSource keeps the site name for multi-part public suffixes", () => {
  assert.equal(inferDataSource("www.example.co.uk"), "example");
  assert.equal(inferDataSource("api.example.com.au"), "example");
  assert.equal(inferDataSource("www.example.co.jp"), "example");
});

test("inferDataSource keeps the previous behaviour for simple hosts", () => {
  assert.equal(inferDataSource("www.example.com"), "example");
  assert.equal(inferDataSource("example.com"), "example");
  assert.equal(inferDataSource("localhost:3000"), "localhost:3000");
});

test("inferDataSource falls back to the URL hostname and then to web", () => {
  assert.equal(inferDataSource(null, "https://www.example.co.uk/dashboard"), "example");
  assert.equal(inferDataSource(null, "https://app.example.com/dashboard"), "example");
  assert.equal(inferDataSource(null, null), "web");
  assert.equal(inferDataSource(null, "not a url"), "web");
});

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
