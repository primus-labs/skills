import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { collectCandidatesForSession } from "./find_candidates.mjs";

async function makeTempSession() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "web-template-capture-"));
  const sessionDir = path.join(root, "session");
  await fs.mkdir(path.join(sessionDir, "responses"), { recursive: true });
  await fs.mkdir(path.join(sessionDir, "dom"), { recursive: true });
  await fs.writeFile(path.join(sessionDir, "session.json"), JSON.stringify({
    site_url: "https://example.com",
    website_icons: []
  }, null, 2));
  return sessionDir;
}

test("collectCandidatesForSession ignores dom snapshots and uses response artifacts only", async () => {
  const sessionDir = await makeTempSession();

  await fs.writeFile(path.join(sessionDir, "responses", "0001_profile.json"), JSON.stringify({
    url: "https://example.com/api/profile",
    page_url: "https://example.com/app",
    method: "GET",
    json: {
      profile: {
        username: "network-user"
      }
    }
  }, null, 2));

  await fs.writeFile(path.join(sessionDir, "responses", "0002_document.json"), JSON.stringify({
    url: "https://example.com/app/profile",
    page_url: "https://example.com/app/profile",
    method: "GET",
    content_type: "text/html",
    body_file: "0002_document.html"
  }, null, 2));
  await fs.writeFile(path.join(sessionDir, "responses", "0002_document.html"), `
    <html>
      <body>
        <main>
          <h1 id="profile-name">html-user</h1>
        </main>
      </body>
    </html>
  `);

  await fs.writeFile(path.join(sessionDir, "dom", "001_navigation.json"), JSON.stringify({
    page_url: "https://example.com/app/profile",
    dom_catalog: [
      {
        xpath: "//*[@id='stale-dom-user']",
        text: "dom-user"
      }
    ]
  }, null, 2));

  const report = await collectCandidatesForSession({
    sessionDir,
    fieldName: "username",
    fieldType: "string",
    hintValue: null,
    ownershipMode: "current_user"
  });

  const sources = new Set(report.top_candidates.map((candidate) => candidate.source_type));
  assert.deepEqual(sources, new Set(["network_json", "document_html"]));
  assert.equal(report.top_candidates.some((candidate) => candidate.sample_value === "dom-user"), false);
  assert.equal(report.top_candidates.some((candidate) => candidate.sample_value === "network-user"), true);
  assert.equal(report.top_candidates.some((candidate) => candidate.sample_value === "html-user"), true);
});
