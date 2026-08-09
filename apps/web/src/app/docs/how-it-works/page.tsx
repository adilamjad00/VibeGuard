import type { Metadata } from "next";
import Link from "next/link";
import { DocsPage } from "@/components/docs/DocsPage";

export const metadata: Metadata = {
  title: "How it works — VibeGuard docs",
  description:
    "The full path from a submitted URL to a finished report: services, scanners, scoring, AI analysis and live progress.",
};

export default function Page() {
  return (
    <DocsPage slug="how-it-works">
      <h2 id="scan-workflow">Scan workflow</h2>
      <p>
        Submitting a scan is a write, not a wait. <code>POST /scans</code> validates the URL, inserts
        a row, enqueues a job and returns <code>202</code> with a scan id — typically in a few
        milliseconds. Everything after that happens on a worker.
      </p>
      <pre>
        <code>{`browser  ──▶  web ──▶ api ──▶ postgres   (scan row, status: queued)
                        └──▶ valkey     (BullMQ job)

worker   ◀── valkey
  clone ▶ scan ▶ dedupe ▶ score ▶ explain ▶ archive
  └──▶ postgres (findings, score, verdict)
  └──▶ storage  (report JSON)
  └──▶ valkey   (progress events, pub/sub)

browser  ◀── api ◀── valkey   (WebSocket, live progress)`}</code>
      </pre>
      <p>
        Decoupling this way means a slow or enormous repository cannot occupy an API process, and the
        API stays responsive no matter what the worker is doing.
      </p>

      <h2 id="security-pipeline">Security pipeline</h2>
      <p>Six services on one private network. Only two of them are reachable from the internet.</p>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Role</th>
            <th>Public</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>web</code>
            </td>
            <td>Next.js UI; proxies <code>/api/*</code> to the API over the private network</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>
              <code>api</code>
            </td>
            <td>Fastify REST, WebSocket and SSE; URL validation; rate limiting</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>
              <code>worker</code>
            </td>
            <td>Cloning, scanners, scoring, LLM enrichment, archiving</td>
            <td>
              <strong>No</strong>
            </td>
          </tr>
          <tr>
            <td>
              <code>db</code>
            </td>
            <td>PostgreSQL — scans, findings, progress events</td>
            <td>No</td>
          </tr>
          <tr>
            <td>
              <code>valkey</code>
            </td>
            <td>BullMQ queue, progress pub/sub, rate-limit counters</td>
            <td>No</td>
          </tr>
          <tr>
            <td>
              <code>storage</code>
            </td>
            <td>Private S3 bucket holding archived reports</td>
            <td>No</td>
          </tr>
        </tbody>
      </table>
      <p>
        The worker has no public ingress at all. It is the component that fetches arbitrary remote
        repositories, so it is the one that should be hardest to reach.
      </p>

      <h2 id="scanner-architecture">Scanner architecture</h2>
      <p>
        Each scanner is an adapter with the same shape: run the binary, parse its output, map it onto
        a normalised finding. Adding a fourth means writing one adapter and adding it to a list.
      </p>
      <p>
        They run concurrently under <code>Promise.allSettled</code>, not <code>Promise.all</code>.
        That distinction is the whole partial-scan guarantee: <code>Promise.all</code> rejects the
        entire batch the moment one scanner throws, discarding the results of the two that succeeded.
        With <code>allSettled</code>, a broken tool degrades coverage instead of destroying the scan.
      </p>
      <p>Exit codes are the other trap. Every one of these tools means something different by them:</p>
      <ul>
        <li>
          <strong>gitleaks</strong> exits non-zero when it finds something, so it is invoked with{" "}
          <code>--exit-code 0</code> and the findings are read from its report.
        </li>
        <li>
          <strong>semgrep</strong> uses <code>0</code> for clean, <code>1</code> for{" "}
          <em>findings were reported</em>, and <code>≥2</code> for a real failure. Treating{" "}
          <code>1</code> as an error would discard every scan that found something.
        </li>
        <li>
          <strong>osv-scanner</strong> uses <code>128</code> for &quot;no packages found&quot;, which
          is a clean result for a repository with no lockfile, not an error.
        </li>
      </ul>
      <p>
        Semgrep&apos;s rulesets are baked into the worker image at build time rather than fetched per
        scan. Fetching them at scan time makes every scan depend on a third-party registry being up
        and not rate-limiting you.
      </p>

      <h3 id="deduplication">De-duplication</h3>
      <p>Scanners overlap, in two different ways, so findings are collapsed twice.</p>
      <ol>
        <li>
          <strong>Within a scanner</strong>, by fingerprint — the same rule reported twice for the same
          location.
        </li>
        <li>
          <strong>Across scanners</strong>, by <code>(file, line, category)</code>, keeping whichever
          tool is the more authoritative source for that category. Without this, a secret found by both
          gitleaks and semgrep would be counted — and penalised — twice.
        </li>
      </ol>
      <p>
        Dependency findings are exempt from the second pass: two advisories against the same package
        are two genuinely different problems.
      </p>

      <h2 id="scoring-system">Scoring system</h2>
      <p>
        The score is a pure function of the findings. Same findings in, same number out, every time —
        no sampling, no model call, no randomness.
      </p>
      <p>
        It starts at 100 and subtracts a weight per finding, scaled by severity. Repeats of the same
        rule are damped: the second instance of a rule costs less than the first, up to a cap. Without
        that damping, four hardcoded secrets from one rule would subtract 100 points on their own and
        every other finding in the repository would be invisible behind a floor of zero.
      </p>
      <p>
        Crucially, the score is computed <strong>before</strong> the model is called, in a separate
        module with no access to it. That is not a policy, it is the call order — which makes it
        structurally impossible for the enrichment pass to influence the verdict.
      </p>
      <p>
        <Link href="/docs/results#understanding-your-score">Full detail in Results</Link>.
      </p>

      <h2 id="ai-analysis">AI analysis</h2>
      <p>
        Once the score exists, Claude runs two passes concurrently. Neither can change the number,
        because the number already exists by the time either starts.
      </p>

      <h3 id="explanation-pass">Explanation</h3>
      <p>
        The most severe findings are sent with the surrounding code snippet. For each one the model
        returns two things: why it matters in this specific codebase, and a concrete fix.
      </p>
      <p>Three constraints on that step:</p>
      <ul>
        <li>
          <strong>It cannot create findings.</strong> The model is given a fixed list and returns prose
          keyed to it. Anything it returns that does not match a known finding is discarded.
        </li>
        <li>
          <strong>Secrets are masked first.</strong> For findings in the secret category, the detected
          value is masked before the snippet leaves the worker.
        </li>
        <li>
          <strong>The snippet is untrusted input.</strong> The system prompt frames it as data to
          analyse, never as instructions — see{" "}
          <Link href="/docs/security#prompt-injection">prompt injection</Link>.
        </li>
      </ul>
      <p>
        If the model call fails or times out, the findings are stored without explanations. Degrading
        to an unexplained finding is correct; dropping the finding would not be.
      </p>

      <h3 id="advisory-review">Advisory review</h3>
      <p>
        Static analysis matches patterns. It is very good at &quot;this string is concatenated into a
        shell command&quot; and structurally incapable of &quot;this route updates a record by id and
        never checks who owns it&quot; — the <em>absence</em> of a check has no pattern to match. The
        second pass reads whole source files looking for exactly that gap: missing or incomplete
        authorization, and untrusted input reaching a model prompt.
      </p>
      <p>
        <strong>Everything it produces is advisory and none of it is scored.</strong> Two independent
        mechanisms enforce that. The score is computed before this pass begins, so ordering alone
        makes it impossible for an observation to move a verdict; and{" "}
        <code>scoredFindings()</code> in the scoring module filters <code>source: &quot;llm&quot;</code>{" "}
        out of both the score and the severity breakdown, so a future caller cannot reintroduce them
        by mistake.
      </p>
      <p>Bounded and validated, because the model is downstream of attacker-controlled text:</p>
      <ul>
        <li>
          At most four files per scan, ~6 KB each, at most six observations — an unbounded review of a
          large repository is a cost incident.
        </li>
        <li>
          Severity is <strong>capped at medium</strong>. A model observation must never out-rank a
          scanner critical in a list sorted worst-first.
        </li>
        <li>
          Every observation is re-checked before it is stored: the category must be one of the four
          allowed, the line must exist in the file, the title must be non-empty. Anything else is
          dropped.
        </li>
        <li>
          Excluded from the re-scan diff. Model output is not reproducible, so including it would
          manufacture phantom fixes and regressions on every re-scan.
        </li>
      </ul>
      <p>
        The pass shares the scan's LLM budget and runs alongside the explanation pass, so it costs no
        extra wall-clock time. If it fails, you get zero advisory findings and a complete report.
      </p>

      <h2 id="report-generation">Report generation</h2>
      <p>
        Findings are written to Postgres first, then the normalised report is archived as JSON to a
        private S3 bucket. That ordering means a storage outage costs the archive and nothing else —
        the report still renders from the database.
      </p>
      <p>
        The archive holds the <em>normalised, redacted</em> findings, not raw scanner output. Raw
        gitleaks output contains the secret values it detected, and writing those to storage would
        turn the security tool into a disclosure channel.
      </p>
      <p>
        The bucket is private and stays private. The download button asks the API to mint a
        short-lived presigned URL rather than making the object readable.
      </p>

      <h2 id="live-progress">Live progress</h2>
      <p>
        The worker publishes a progress event to Valkey at each stage and writes the same event to
        Postgres. The API subscribes and relays to connected clients.
      </p>
      <p>
        When you open a result page mid-scan, the API subscribes first, buffers, replays the stored
        history, resolves the terminal state from the database, then flushes the buffer — so a client
        joining halfway through sees the same sequence as one that was there from the start, with no
        gap and no duplicates.
      </p>
      <p>
        The transport is a <strong>WebSocket</strong> rather than server-sent events, for a measured
        reason. The platform&apos;s shared L7 balancer runs with <code>proxy_buffering on</code>, which
        holds an SSE response until the stream ends — measured at 40–66 seconds, i.e. the entire scan
        arriving in one burst at the end. It is not configurable for a shared subdomain. An upgraded
        WebSocket is a tunnel rather than a buffered response body, so it is unaffected. The SSE
        endpoint still exists and is still correct behind any non-buffering proxy.
      </p>
      <p>
        Both transports share the same feed implementation, so they cannot drift apart. If neither is
        available, the page falls back to polling — including when a proxy accepts the connection and
        then goes silent, which is detected as a four-second stall rather than an error, because a
        buffering proxy never raises one.
      </p>
      <p>
        Progress is published fire-and-forget. It is an overlay on a pipeline whose real state lives
        in Postgres, so a Valkey blip costs you the animation and nothing else.
      </p>
    </DocsPage>
  );
}
