import { test } from "node:test";
import assert from "node:assert/strict";
import { isUuid } from "./uuid.js";

/**
 * The SSE route interpolates the scan id into a Valkey channel name
 * (`scan:${id}`). That makes this guard a security control, not a formatting
 * nicety: anything that slips through picks the channel the caller subscribes
 * to. These cases are the ones that would matter if it were ever loosened.
 */

test("accepts a real uuid in either case", () => {
  assert.equal(isUuid("9635fa17-7a16-4a0d-9a39-ce4edde3b19f"), true);
  assert.equal(isUuid("9635FA17-7A16-4A0D-9A39-CE4EDDE3B19F"), true);
});

test("rejects ids that would escape the scan: channel namespace", () => {
  for (const hostile of [
    "*",                                        // subscribe to everything
    "scan:*",
    "../admin",
    "9635fa17-7a16-4a0d-9a39-ce4edde3b19f*",    // suffix glob
    "9635fa17-7a16-4a0d-9a39-ce4edde3b19f\nSUBSCRIBE other", // newline injection
    "9635fa17-7a16-4a0d-9a39-ce4edde3b19f other",
  ]) {
    assert.equal(isUuid(hostile), false, `should reject ${JSON.stringify(hostile)}`);
  }
});

test("rejects near-misses and empty input", () => {
  assert.equal(isUuid(""), false);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("9635fa17-7a16-4a0d-9a39-ce4edde3b19"), false);   // too short
  assert.equal(isUuid("9635fa17-7a16-4a0d-9a39-ce4edde3b19ff"), false); // too long
  assert.equal(isUuid("g635fa17-7a16-4a0d-9a39-ce4edde3b19f"), false);  // non-hex
});
