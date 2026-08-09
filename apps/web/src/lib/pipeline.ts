/**
 * The pipeline as the user sees it.
 *
 * Five steps, every one of them derived from something the backend actually
 * reports — no invented progress. The worker emits `cloning`, `scanning`,
 * `scanning:<scanner>`, `analyzing` and `done`; this maps those onto the
 * stages a person cares about.
 *
 * "Scoring" is the subtle one. It has no event of its own because it is a
 * synchronous pure function, but the pipeline computes the score from the
 * scanner output *before* it emits `analyzing` — so by the time that event
 * arrives, scoring is genuinely finished. It is therefore shown as complete
 * rather than in progress, which is the honest rendering: it never takes long
 * enough to be "running".
 */

export interface PipelineStep {
  key: string;
  label: string;
  detail: string;
}

export const PIPELINE_STEPS: readonly PipelineStep[] = [
  {
    key: "queued",
    label: "Queued & validated",
    detail: "The URL passed the allowlist and the job is on the Valkey queue",
  },
  {
    key: "cloning",
    label: "Cloning repository",
    detail: "Shallow clone into a disposable sandbox on a private worker",
  },
  {
    key: "scanning",
    label: "Running scanners",
    detail: "gitleaks · semgrep · osv-scanner, concurrently and independently",
  },
  {
    key: "scoring",
    label: "Scoring",
    detail: "Deterministic score computed from the scanner output alone",
  },
  {
    key: "analyzing",
    label: "Explaining & archiving",
    detail: "Claude adds why-it-matters and a fix, then the report is stored",
  },
] as const;

export const TERMINAL_PHASES = new Set(["done", "failed"]);

/**
 * How far the pipeline has got, as an index into PIPELINE_STEPS. Steps before
 * it are complete, the step at it is in progress, and a value equal to the
 * length means everything is finished.
 *
 * `analyzing` maps to 4 rather than 3 because scoring precedes it in the
 * worker — see the note above.
 */
export function reachedStepIndex(phase: string): number {
  if (TERMINAL_PHASES.has(phase)) return PIPELINE_STEPS.length;

  // `scanning:semgrep` counts as having reached `scanning`.
  const base = phase.split(":")[0] ?? phase;

  switch (base) {
    case "queued":
      return 0;
    case "cloning":
      return 1;
    case "scanning":
      return 2;
    case "analyzing":
      return 4;
    default:
      // An unknown phase should not rewind the rail past the start.
      return 0;
  }
}

export type StepState = "done" | "active" | "pending";

export function stepState(index: number, reached: number): StepState {
  if (reached > index) return "done";
  if (reached === index) return "active";
  return "pending";
}
