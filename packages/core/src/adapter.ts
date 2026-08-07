import type { NormalizedFinding } from "./types.js";

export interface ScanContext {
  repoPath: string;   // local path to the cloned working tree
  scanId: string;
}

/** Every scanner implements this. Add a new tool = add a new adapter. */
export interface ScannerAdapter {
  name: string;
  run(ctx: ScanContext): Promise<NormalizedFinding[]>;
}
