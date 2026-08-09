import type { Metadata } from "next";
import Link from "next/link";
import { DocsPage } from "@/components/docs/DocsPage";

export const metadata: Metadata = {
  title: "Getting started — VibeGuard docs",
  description: "Run your first scan and learn how to read the report that comes back.",
};

export default function Page() {
  return (
    <DocsPage slug="getting-started">
      <h2 id="quick-start">Quick start</h2>
      <p>
        There is no account, no installation and no configuration. Open{" "}
        <Link href="/scan">the scan page</Link>, paste a public GitHub repository URL, and press
        <strong> Scan repository</strong>.
      </p>
      <pre>
        <code>{`https://github.com/<owner>/<repo>`}</code>
      </pre>
      <p>
        You are redirected to a result page immediately, before the scan has finished. That page
        streams progress over a WebSocket and swaps itself for the report the moment the scan
        completes. The URL is permanent — bookmark it, share it, or close the tab and come back.
      </p>

      <h2 id="first-scan">Running your first scan</h2>
      <p>
        If you want to see a report with real findings in it rather than a clean one, the scan page
        has a <strong>demo repo</strong> button. It points at a deliberately vulnerable Node
        application containing committed secrets, a command-injection sink and a dependency with a
        published advisory — one for each scanner.
      </p>
      <p>A scan moves through five stages:</p>
      <ol>
        <li>
          <strong>Queued and validated.</strong> The URL is checked against an allowlist and a job is
          placed on the queue. Anything that is not a public github.com repository root is rejected
          here, before it is stored.
        </li>
        <li>
          <strong>Cloning.</strong> A private worker shallow-clones the repository into a temporary
          directory.
        </li>
        <li>
          <strong>Running scanners.</strong> gitleaks, semgrep and osv-scanner run concurrently and
          independently.
        </li>
        <li>
          <strong>Scoring.</strong> The findings are de-duplicated and the score is computed. This
          happens before the model is involved.
        </li>
        <li>
          <strong>Explaining and archiving.</strong> Each finding gets an explanation and a fix, then
          the report is written to object storage.
        </li>
      </ol>
      <p>Typical end-to-end time is around thirty seconds for a small repository.</p>

      <h2 id="what-you-can-scan">What you can scan</h2>
      <table>
        <thead>
          <tr>
            <th>Supported</th>
            <th>Not supported</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Public repositories on github.com</td>
            <td>Private repositories</td>
          </tr>
          <tr>
            <td>The repository root (default branch)</td>
            <td>Other hosts — GitLab, Bitbucket, self-hosted</td>
          </tr>
          <tr>
            <td>Any language the scanners cover</td>
            <td>Sub-paths, single files, specific branches or tags</td>
          </tr>
          <tr>
            <td>Repositories within the clone size limit</td>
            <td>Zip or archive uploads</td>
          </tr>
        </tbody>
      </table>
      <p>
        The restriction to public repositories is deliberate. Supporting private ones means holding a
        credential that can read your source, and that is not a thing to add casually.
      </p>

      <h2 id="reading-the-result">Reading the result</h2>
      <p>The report is arranged so you can stop after the first screen and still have the answer.</p>
      <ul>
        <li>
          <strong>The verdict and score</strong> come first — one word and one number for whether this
          is safe to ship.
        </li>
        <li>
          <strong>Severity breakdown</strong> shows how the findings are distributed, including the
          zeroes.
        </li>
        <li>
          <strong>Scanner coverage</strong> shows what actually ran. A scanner that crashed is marked{" "}
          <code>failed</code>, which is a different thing from <code>0 findings</code>.
        </li>
        <li>
          <strong>Findings</strong> are listed worst first. Criticals are expanded by default; each
          card carries the file and line, the offending snippet, why it matters and a fix you can copy
          to the clipboard.
        </li>
      </ul>
      <p>
        <Link href="/docs/results">Understanding your score</Link> goes through each of these in
        detail.
      </p>
    </DocsPage>
  );
}
