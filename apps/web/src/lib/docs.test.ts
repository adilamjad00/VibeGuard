import { test } from "node:test";
import assert from "node:assert/strict";
import { DOC_SECTIONS, docPath, findSection, siblings } from "./docs.js";

test("every docs section has a unique slug", () => {
  const slugs = DOC_SECTIONS.map((section) => section.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("anchor ids are unique within a section", () => {
  // A duplicate would make the sidebar link to the wrong heading and break the
  // "on this page" list silently.
  for (const section of DOC_SECTIONS) {
    const ids = section.anchors.map((anchor) => anchor.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate anchor in ${section.slug}`);
  }
});

test("slugs and anchor ids are URL-safe", () => {
  for (const section of DOC_SECTIONS) {
    assert.match(section.slug, /^[a-z0-9-]+$/, `bad slug: ${section.slug}`);
    for (const anchor of section.anchors) {
      assert.match(anchor.id, /^[a-z0-9-]+$/, `bad anchor: ${anchor.id}`);
    }
  }
});

test("every section has a summary and at least one anchor", () => {
  for (const section of DOC_SECTIONS) {
    assert.ok(section.summary.length > 0, `${section.slug} has no summary`);
    assert.ok(section.anchors.length > 0, `${section.slug} has no anchors`);
  }
});

test("findSection resolves known slugs and rejects unknown ones", () => {
  assert.equal(findSection("introduction")?.title, "Introduction");
  assert.equal(findSection("does-not-exist"), undefined);
});

test("the pager terminates at both ends rather than wrapping", () => {
  const first = DOC_SECTIONS[0]!;
  const last = DOC_SECTIONS[DOC_SECTIONS.length - 1]!;
  assert.equal(siblings(first.slug).prev, null);
  assert.equal(siblings(last.slug).next, null);
});

test("the pager walks the whole sequence forwards", () => {
  const visited: string[] = [];
  let current: string | null = DOC_SECTIONS[0]!.slug;
  while (current) {
    visited.push(current);
    current = siblings(current).next?.slug ?? null;
  }
  assert.deepEqual(
    visited,
    DOC_SECTIONS.map((section) => section.slug),
  );
});

test("siblings of an unknown slug are both null", () => {
  assert.deepEqual(siblings("nope"), { prev: null, next: null });
});

test("docPath builds section and anchor links", () => {
  assert.equal(docPath("security"), "/docs/security");
  assert.equal(docPath("security", "ssrf-protection"), "/docs/security#ssrf-protection");
});
