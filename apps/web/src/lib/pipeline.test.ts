import { test } from "node:test";
import assert from "node:assert/strict";
import { PIPELINE_STEPS, reachedStepIndex, stepState } from "./pipeline.js";

/** Index of a step by key, so the tests do not hardcode positions. */
function indexOf(key: string): number {
  return PIPELINE_STEPS.findIndex((step) => step.key === key);
}

test("each phase maps to its own step", () => {
  assert.equal(reachedStepIndex("queued"), indexOf("queued"));
  assert.equal(reachedStepIndex("cloning"), indexOf("cloning"));
  assert.equal(reachedStepIndex("scanning"), indexOf("scanning"));
});

test("per-scanner ticks count as still scanning", () => {
  // The worker emits `scanning:gitleaks` etc.; the rail must not jump ahead.
  for (const scanner of ["gitleaks", "semgrep", "osv"]) {
    assert.equal(reachedStepIndex(`scanning:${scanner}`), indexOf("scanning"));
  }
});

test("analyzing implies scoring is already complete", () => {
  // The worker computes the score before it emits `analyzing`, so by the time
  // that event arrives scoring is genuinely finished — not in progress.
  const reached = reachedStepIndex("analyzing");
  assert.equal(reached, indexOf("analyzing"));
  assert.equal(stepState(indexOf("scoring"), reached), "done");
  assert.equal(stepState(indexOf("analyzing"), reached), "active");
});

test("terminal phases complete every step", () => {
  for (const phase of ["done", "failed"]) {
    const reached = reachedStepIndex(phase);
    assert.equal(reached, PIPELINE_STEPS.length);
    for (let i = 0; i < PIPELINE_STEPS.length; i += 1) {
      assert.equal(stepState(i, reached), "done");
    }
  }
});

test("an unrecognised phase does not advance the rail", () => {
  assert.equal(reachedStepIndex("something-new"), 0);
  assert.equal(reachedStepIndex(""), 0);
});

test("stepState reports done, active and pending in order", () => {
  const reached = indexOf("scanning");
  assert.equal(stepState(reached - 1, reached), "done");
  assert.equal(stepState(reached, reached), "active");
  assert.equal(stepState(reached + 1, reached), "pending");
});

test("every step has a label and a detail", () => {
  for (const step of PIPELINE_STEPS) {
    assert.ok(step.label.length > 0, `${step.key} has no label`);
    assert.ok(step.detail.length > 0, `${step.key} has no detail`);
  }
});
