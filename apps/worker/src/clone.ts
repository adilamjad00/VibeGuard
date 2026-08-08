import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);

const CLONE_TIMEOUT_MS = Number(process.env.CLONE_TIMEOUT_MS ?? 120_000);
const MAX_REPO_BYTES = Number(process.env.MAX_REPO_BYTES ?? 250 * 1024 * 1024);

export interface ClonedRepo {
  /** Absolute path to the working tree. */
  path: string;
  commitSha: string | null;
  /** Always call this, in a finally block. */
  cleanup: () => Promise<void>;
}

/**
 * Shallow-clone a public repository into a disposable temp directory.
 *
 * The cloned code is *never executed* — not here, not by any adapter. No
 * dependency install, no build step, no lifecycle scripts. Every scanner reads
 * the tree as inert text. That is the property that makes it safe to point this
 * service at a stranger's repository.
 *
 * git is given no opportunity to run code either. Hooks are disabled, the
 * ext/file transports are refused, and credential helpers are cleared so a
 * hostile URL cannot make git shell out or hand credentials to a remote.
 */
export async function cloneRepo(repoUrl: string): Promise<ClonedRepo> {
  const dir = await mkdtemp(join(tmpdir(), "vibeguard-"));
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  };

  try {
    await run(
      "git",
      [
        // `-c` options are applied before the remote is contacted.
        "-c", "core.hooksPath=/dev/null",   // never run a hook from the clone
        "-c", "protocol.ext.allow=never",   // ext:: transport executes commands
        "-c", "protocol.file.allow=never",  // file:: can reach the local disk
        "-c", "credential.helper=",         // no helper may supply credentials
        "clone",
        "--depth", "1",
        "--single-branch",
        "--no-tags",
        "--quiet",
        "--",                               // nothing after this is an option
        repoUrl,
        dir,
      ],
      {
        timeout: CLONE_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0", // never block waiting for a password
          GIT_ASKPASS: "",
          GIT_CONFIG_NOSYSTEM: "1", // ignore machine-level git config
          HOME: dir,                // and any ~/.gitconfig
        },
      },
    );
  } catch (err) {
    await cleanup();
    throw new Error(`clone failed: ${cloneErrorMessage(err)}`);
  }

  const size = await directorySize(dir, MAX_REPO_BYTES);
  if (size === null) {
    await cleanup();
    throw new Error(`repository exceeds the ${Math.round(MAX_REPO_BYTES / 1024 / 1024)} MB scan limit`);
  }

  let commitSha: string | null = null;
  try {
    const { stdout } = await run("git", ["-C", dir, "rev-parse", "HEAD"], { timeout: 10_000 });
    commitSha = stdout.trim() || null;
  } catch {
    // A missing SHA costs us a display field, not the scan.
  }

  return { path: dir, commitSha, cleanup };
}

/** Total bytes under `dir`, or null as soon as `limit` is exceeded. */
async function directorySize(dir: string, limit: number): Promise<number | null> {
  let total = 0;
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      // Do not follow symlinks: a repo can contain a link to / and turn this
      // walk into an unbounded traversal of the container's filesystem.
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += (await stat(full)).size;
        } catch {
          continue;
        }
        if (total > limit) return null;
      }
    }
  }
  return total;
}

function cloneErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { killed?: boolean; stderr?: string; message?: string };
    if (e.killed) return "timed out";
    const stderr = (e.stderr ?? "").trim();
    if (stderr) return stderr.split("\n").slice(-1)[0]!.slice(0, 300);
    if (e.message) return e.message.slice(0, 300);
  }
  return String(err).slice(0, 300);
}
