import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The runtime-prepare phase that installs these binaries is the riskiest part
 * of the whole deploy, and it fails silently — the worker starts fine and only
 * produces empty scans. Probing versions at boot turns that into one line in
 * the service log instead of a mystery found mid-demo.
 */
const TOOLS = [
  { name: "semgrep", args: ["--version"] },
  { name: "gitleaks", args: ["version"] },
  { name: "osv-scanner", args: ["--version"] },
] as const;

export type ToolStatus = { name: string; available: boolean; detail: string };

async function probe(name: string, args: readonly string[]): Promise<ToolStatus> {
  try {
    const { stdout, stderr } = await run(name, [...args], { timeout: 20_000 });
    const detail = (stdout || stderr).trim().split("\n")[0] ?? "";
    return { name, available: true, detail };
  } catch (err) {
    return { name, available: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Never throws. A missing scanner degrades coverage; it must not stop the worker. */
export async function checkScannerTools(): Promise<ToolStatus[]> {
  const results = await Promise.all(TOOLS.map((t) => probe(t.name, t.args)));

  for (const r of results) {
    if (r.available) console.log(`[tools] ${r.name}: ${r.detail}`);
    else console.error(`[tools] ${r.name}: UNAVAILABLE — ${r.detail}`);
  }

  const missing = results.filter((r) => !r.available).map((r) => r.name);
  if (missing.length === results.length) {
    console.error("[tools] no scanners available — scans will return no findings");
  } else if (missing.length > 0) {
    console.warn(`[tools] degraded: running without ${missing.join(", ")}`);
  }
  return results;
}
