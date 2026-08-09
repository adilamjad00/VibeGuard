import type { Metadata } from "next";
import Link from "next/link";
import { DocsPage } from "@/components/docs/DocsPage";

export const metadata: Metadata = {
  title: "Results — VibeGuard docs",
  description:
    "How to read the Ship Readiness Score, the verdict, individual findings, the severity ramp and a partial scan.",
};

export default function Page() {
  return (
    <DocsPage slug="results">
      <h2 id="understanding-your-score">Understanding your score</h2>
      <p>
        The Ship Readiness Score is a number from 0 to 100. It starts at 100 and subtracts a penalty
        for every finding, weighted by severity:
      </p>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Weight</th>
            <th>Roughly</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>critical</td>
            <td>25</td>
            <td>Four of these on their own take you to zero</td>
          </tr>
          <tr>
            <td>high</td>
            <td>10</td>
            <td>Ten to zero</td>
          </tr>
          <tr>
            <td>medium</td>
            <td>4</td>
            <td>Meaningful but not decisive</td>
          </tr>
          <tr>
            <td>low</td>
            <td>1</td>
            <td>Noise-level individually</td>
          </tr>
          <tr>
            <td>info</td>
            <td>0</td>
            <td>Reported, never penalised</td>
          </tr>
        </tbody>
      </table>

      <h3 id="repetition-damping">Repetition damping</h3>
      <p>
        Repeats of the <em>same rule</em> cost progressively less, up to a cap of twice the base
        weight. Four secrets from a single gitleaks rule are not four times as bad as one — they are
        one mistake made four times, usually in one file, fixed in one edit.
      </p>
      <p>
        Without damping the score saturates at zero almost immediately and stops carrying information:
        a repository with four hardcoded keys and a repository with four keys plus a command-injection
        sink would both read 0. Damping keeps the number meaningful in the range where people actually
        live.
      </p>
      <p>
        Findings from different rules are never damped against each other, and dependency findings are
        keyed by package so two advisories against different packages count separately.
      </p>

      <h3 id="determinism">Determinism</h3>
      <p>
        The same set of findings always produces the same score. It is computed by a pure function
        from the scanner output, before the language model is called, in a module that has no access
        to it. You can re-run a scan on an unchanged commit and get the same number.
      </p>

      <h2 id="verdicts">Verdicts</h2>
      <table>
        <thead>
          <tr>
            <th>Verdict</th>
            <th>Score</th>
            <th>What it means</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>pass</code>
            </td>
            <td>85 – 100</td>
            <td>No blocking issues from the checks that ran.</td>
          </tr>
          <tr>
            <td>
              <code>review</code>
            </td>
            <td>50 – 84</td>
            <td>Real issues that are not immediately exploitable. Read them before shipping.</td>
          </tr>
          <tr>
            <td>
              <code>block</code>
            </td>
            <td>0 – 49</td>
            <td>At least one finding is severe enough to be exploited as-is.</td>
          </tr>
        </tbody>
      </table>
      <p>
        A <code>pass</code> is not a clean bill of health. It means these specific checks found
        nothing — see{" "}
        <Link href="/docs/introduction#what-it-does-not-claim">what VibeGuard does not claim</Link>.
      </p>

      <h2 id="understanding-findings">Understanding findings</h2>
      <p>Every finding carries the same fields, whichever scanner produced it:</p>
      <ul>
        <li>
          <strong>Severity</strong> — normalised onto one five-level ramp across all three scanners, so
          a &quot;high&quot; means the same thing regardless of origin.
        </li>
        <li>
          <strong>Source</strong> — which scanner found it. Useful context: a semgrep hit and a gitleaks
          hit have very different false-positive profiles.
        </li>
        <li>
          <strong>Category</strong> — secret, injection, dependency, crypto, access control, and so on.
        </li>
        <li>
          <strong>Location</strong> — repository-relative path and line. Paths are relative to the repo
          root, not the temporary clone directory, so they match what you see in your editor.
        </li>
        <li>
          <strong>Snippet</strong> — the offending code, with detected secret values masked.
        </li>
        <li>
          <strong>Explanation and fix</strong> — added by the model. If the enrichment pass did not
          cover a finding it is marked <code>unexplained</code>; the detection itself is unaffected.
        </li>
        <li>
          <strong>Fingerprint</strong> — a stable identifier derived from the rule and location, not the
          clone path, so it is the same across runs and machines.
        </li>
      </ul>
      <p>
        Findings are sorted worst first, then by file and line. Criticals are expanded by default. The
        copy button puts the whole finding — location, snippet, explanation and fix — on the clipboard
        in a form you can paste into an editor chat or an issue.
      </p>

      <h3 id="advisory-findings">Advisory findings</h3>
      <p>
        Below the findings list you may see an <strong>AI review</strong> section. Those are model
        observations about weaknesses a pattern cannot express — a route that never checks who is
        asking, untrusted input reaching a prompt — and they are marked{" "}
        <em>advisory · not scored</em> because that is exactly what they are.
      </p>
      <p>
        They do not appear in the score, the severity breakdown, the finding count or the re-scan
        diff. Read them as leads worth checking, not as confirmed findings; unlike a scanner rule they
        are not reproducible run to run.
      </p>

      <h3 id="false-positives">False positives</h3>
      <p>
        Scanners do not know your intent. A test fixture containing a fake AWS key is a hardcoded
        secret as far as gitleaks is concerned, and an example of an injection pattern in a code
        comment can still trip a rule. The explanation usually makes this obvious on reading, but the
        score cannot tell the difference — so a repository full of security examples will score badly
        and be right to.
      </p>

      <h2 id="severity-levels">Severity levels</h2>
      <table>
        <thead>
          <tr>
            <th>Level</th>
            <th>Typical finding</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>critical</strong>
            </td>
            <td>
              A live credential in the source tree; remote command execution built from user input.
              Exploitable as it stands.
            </td>
          </tr>
          <tr>
            <td>
              <strong>high</strong>
            </td>
            <td>
              A dependency with a published high-severity advisory; an injection sink whose reachability
              depends on how it is called.
            </td>
          </tr>
          <tr>
            <td>
              <strong>medium</strong>
            </td>
            <td>Weak hashing, permissive defaults, missing validation on a non-critical path.</td>
          </tr>
          <tr>
            <td>
              <strong>low</strong>
            </td>
            <td>Hardening opportunities and defence-in-depth gaps.</td>
          </tr>
          <tr>
            <td>
              <strong>info</strong>
            </td>
            <td>Worth knowing, never penalised.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Severity is always shown with its label as well as its colour — colour is never the only
        carrier of meaning.
      </p>

      <h2 id="partial-scans">Partial scans</h2>
      <p>
        If a scanner fails, the scan continues with the others and the report opens with a{" "}
        <strong>partial scan</strong> banner naming what did not run. The scanner coverage panel shows
        it as <code>failed</code>, which is deliberately a different state from{" "}
        <code>0 findings</code>.
      </p>
      <p>
        <strong>Read a partial score as a floor.</strong> It was computed from fewer checks, so the
        real number can only be the same or worse. It is not a clean bill of health with an asterisk;
        there are whole categories nobody looked at.
      </p>
      <p>
        If <em>every</em> scanner fails, there is no report at all. The scan is marked{" "}
        <code>failed</code> and no score is shown — because a score computed from nothing would imply
        the code had been checked.
      </p>
    </DocsPage>
  );
}
