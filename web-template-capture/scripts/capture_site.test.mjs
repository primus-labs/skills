import test from "node:test";
import assert from "node:assert/strict";

import {
  isAuthenticationInProgressUrl,
  isReadyToResumeAfterAuthentication
} from "./capture_site.mjs";

test("two-factor routes still count as authentication in progress", () => {
  assert.equal(isAuthenticationInProgressUrl("https://github.com/login"), true);
  assert.equal(isAuthenticationInProgressUrl("https://github.com/sessions/two-factor"), true);
  assert.equal(isAuthenticationInProgressUrl("https://github.com/sessions/two-factor/app"), true);
  assert.equal(isAuthenticationInProgressUrl("https://idp.example.com/challenge/otp"), true);
});

test("resume stays blocked while authentication signals are still present", () => {
  assert.equal(isReadyToResumeAfterAuthentication({
    currentUrl: "https://github.com/",
    entryUrl: "https://github.com/",
    authSignalsPresent: true
  }), false);
  assert.equal(isReadyToResumeAfterAuthentication({
    currentUrl: "https://github.com/login",
    entryUrl: "https://github.com/",
    authSignalsPresent: false
  }), false);
});

test("resume can continue once authentication signals disappear on the entry route", () => {
  assert.equal(isReadyToResumeAfterAuthentication({
    currentUrl: "https://github.com/",
    entryUrl: "https://github.com/",
    authSignalsPresent: false
  }), true);
});

test("resume can continue on a deeper in-site route after authentication", () => {
  assert.equal(isReadyToResumeAfterAuthentication({
    currentUrl: "https://app.example.com/dashboard",
    entryUrl: "https://app.example.com/",
    authSignalsPresent: false
  }), true);
});

test("resume stays blocked on unrelated origins", () => {
  assert.equal(isReadyToResumeAfterAuthentication({
    currentUrl: "https://accounts.example.net/app",
    entryUrl: "https://app.example.com/",
    authSignalsPresent: false
  }), false);
});
