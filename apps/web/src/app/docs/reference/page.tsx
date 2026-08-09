import type { Metadata } from "next";
import Link from "next/link";
import { DocsPage } from "@/components/docs/DocsPage";

export const metadata: Metadata = {
  title: "Reference — VibeGuard docs",
  description: "Scanner details, current limits, and the questions that come up most.",
};

export default function Page() {
  return (
    <DocsPage slug="reference">
      <h2 id="supported-scanners">Supported scanners</h2>
      <table>
        <thead>
          <tr>
            <th>Scanner</th>
            <th>Finds</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>gitleaks</strong>
            </td>
            <td>
              Committed credentials — API keys, tokens, private keys, connection strings — in the
              working tree and in git history.
            </td>
            <td>
              <code>secret</code>
            </td>
          </tr>
          <tr>
            <td>
              <strong>semgrep</strong>
            </td>
            <td>
              Static analysis over source. Command and SQL injection sinks, unsafe{" "}
              <code>eval</code>, weak crypto, insecure deserialisation, auth mistakes.
            </td>
            <td>
              <code>injection</code>, <code>crypto</code>, <code>authz</code>, <code>smell</code>
            </td>
          </tr>
          <tr>
            <td>
              <strong>osv-scanner</strong>
            </td>
            <td>
              Known advisories from the OSV database, matched against the exact versions in your
              lockfile rather than the ranges in your manifest.
            </td>
            <td>
              <code>dependency</code>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Claude</strong>
            </td>
            <td>
              Not a scanner. Explains each finding and proposes a fix. Cannot create, remove or re-rank
              findings, and cannot change the score.
            </td>
            <td>enrichment</td>
          </tr>
        </tbody>
      </table>
      <p>
        Semgrep runs with vendored rulesets baked into the worker image — security-audit, javascript
        and secrets — rather than fetching them per scan, so a registry outage or rate limit cannot
        fail a scan.
      </p>

      <h2 id="limits">Limits</h2>
      <ul>
        <li>
          <strong>Public GitHub repositories only.</strong> Supporting private ones means holding a
          credential that can read your source.
        </li>
        <li>
          <strong>Default branch, repository root.</strong> No branch, tag, commit or sub-path
          selection.
        </li>
        <li>
          <strong>Rate limited.</strong> Scan submissions are capped per source IP per minute. Reads
          are generous.
        </li>
        <li>
          <strong>Clone size cap.</strong> Very large repositories are rejected rather than being
          allowed to occupy a worker indefinitely.
        </li>
        <li>
          <strong>The explanation pass covers the most severe findings first</strong> and is bounded.
          On a report with many findings, the least severe may arrive unexplained.
        </li>
        <li>
          <strong>No history.</strong> There are no accounts, so there is no per-user scan history —
          keep the result URL.
        </li>
      </ul>

      <h2 id="faq">FAQ</h2>

      <h3 id="faq-executed">Is my code executed?</h3>
      <p>
        No. There is no install, no build and no lifecycle script. The repository is read as text by
        three static tools and the clone is deleted when the scan ends. See{" "}
        <Link href="/docs/security#repository-handling">repository handling</Link>.
      </p>

      <h3 id="faq-private">Can I scan a private repository?</h3>
      <p>
        Not currently. It would require holding a token that can read your source, which is not
        something to add without a lot more thought about how it is stored and scoped.
      </p>

      <h3 id="faq-ai-findings">Does the AI decide the score?</h3>
      <p>
        No, and it structurally cannot. The score is computed by a pure function from scanner output
        before the model is called. The model only writes the explanation and the fix. A repository
        cannot argue its way to a better number — including by putting instructions in its own source,
        which the demo repository does.
      </p>

      <h3 id="faq-false-positive">A finding is a false positive. Can I dismiss it?</h3>
      <p>
        Not yet. Scanners do not know your intent, so a fake key in a test fixture is still a
        hardcoded secret to them. The explanation usually makes this obvious, but the score does not
        distinguish. Suppression would need a per-repository config, which means state, which means
        accounts.
      </p>

      <h3 id="faq-partial">Why does my report say &quot;partial scan&quot;?</h3>
      <p>
        One of the scanners failed. The others still ran and their findings are real, but the score
        was computed from fewer checks — read it as a floor. See{" "}
        <Link href="/docs/results#partial-scans">partial scans</Link>.
      </p>

      <h3 id="faq-clean">I got a high score. Am I secure?</h3>
      <p>
        You are clean on the checks that ran. Business logic flaws, access control between users, race
        conditions and infrastructure configuration are not covered by any of these tools. See{" "}
        <Link href="/docs/introduction#what-it-does-not-claim">what VibeGuard does not claim</Link>.
      </p>

      <h3 id="faq-rescan">Can I re-scan after fixing something?</h3>
      <p>
        Yes — submit the same URL again. Scoring is deterministic, so any change in the number is a
        change in your code, not in the tool.
      </p>

      <h3 id="faq-progress">The progress bar stopped updating. Is the scan dead?</h3>
      <p>
        Almost certainly not. If the live connection drops, the page falls back to polling and still
        picks up the result. The scan itself runs on the worker and does not depend on your browser
        being connected — you can close the tab and return to the same URL.
      </p>
    </DocsPage>
  );
}
