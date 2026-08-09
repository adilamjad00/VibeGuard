import type { Metadata } from "next";
import Link from "next/link";
import { DocsPage } from "@/components/docs/DocsPage";

export const metadata: Metadata = {
  title: "Introduction — VibeGuard docs",
  description:
    "What VibeGuard is, the problem it addresses, who it is for, and what it deliberately does not claim.",
};

export default function Page() {
  return (
    <DocsPage slug="introduction">
      <h2 id="what-is-vibeguard">What is VibeGuard?</h2>
      <p>
        VibeGuard is a security and quality gate for code you did not write line by line. You give it
        a public GitHub repository URL. It clones the repository into a disposable sandbox, runs
        three independent security scanners over it, merges and de-duplicates what they find, scores
        the result from 0 to 100, and asks a language model to explain each finding and suggest a
        fix.
      </p>
      <p>
        The output is a single report: a <strong>Ship Readiness Score</strong>, a verdict of{" "}
        <code>pass</code>, <code>review</code> or <code>block</code>, and a list of findings ordered
        worst first, each with a file, a line, an explanation and a remediation.
      </p>
      <p>
        The important structural detail is the order of operations. The scanners produce the
        findings. The score is computed from those findings by a pure function. Only then does the
        model see anything. The model writes prose; it never adds, removes or re-ranks a finding, and
        it cannot change the score.
      </p>

      <h2 id="why-vibeguard">Why VibeGuard?</h2>
      <p>
        Generated code is fluent. It compiles, it reads well, it passes a skim review — and those are
        exactly the properties that make its security problems easy to miss. The failures are
        boringly consistent:
      </p>
      <ul>
        <li>
          <strong>Credentials in the source tree.</strong> A model asked for a working example will
          happily write a config file with a real-looking key in it, and that file gets committed.
        </li>
        <li>
          <strong>String-built commands and queries.</strong> <code>exec()</code> with request data
          in it, SQL assembled by concatenation. Both look completely ordinary.
        </li>
        <li>
          <strong>Stale dependencies.</strong> Package versions from the model&apos;s training data,
          carrying advisories published since.
        </li>
      </ul>
      <p>
        None of these need a clever detector. They need someone to actually run the tools. VibeGuard
        is that step, reduced to pasting a URL.
      </p>

      <h2 id="who-its-for">Who it is for</h2>
      <ul>
        <li>
          Developers shipping something built quickly with an AI assistant, who want a check before it
          goes public.
        </li>
        <li>
          Anyone reviewing a repository they did not write — a template, a starter, a contractor&apos;s
          handover, an open-source dependency they are about to adopt.
        </li>
        <li>
          People learning what these tools find. Every finding is explained rather than just cited, so
          the report doubles as a walkthrough.
        </li>
      </ul>

      <h2 id="what-it-does-not-claim">What it does not claim</h2>
      <p>
        This matters more than the feature list, because a security tool that overstates itself is
        worse than no tool.
      </p>
      <ul>
        <li>
          <strong>A high score is not proof of safety.</strong> It means the checks that ran came back
          clean. Whole categories — business logic, access control between users, race conditions,
          infrastructure configuration — are not covered by any of these scanners.
        </li>
        <li>
          <strong>It is not a penetration test.</strong> Nothing is executed and nothing is probed at
          runtime. This is static analysis over source text plus a dependency lookup.
        </li>
        <li>
          <strong>It is not a compliance certification.</strong> There is no audit trail, no attestation
          and no standard being certified against.
        </li>
        <li>
          <strong>Scanners produce false positives.</strong> A test fixture with a fake key in it is
          still a secret as far as gitleaks is concerned. The explanation usually makes this obvious,
          but the score does not know the difference.
        </li>
        <li>
          <strong>A partial scan is a floor, not a result.</strong> If a scanner fails, the score is
          computed from fewer checks and the report says so. Read it as &quot;at least this bad&quot;.
        </li>
      </ul>

      <p>
        Next:{" "}
        <Link href="/docs/getting-started">run your first scan</Link>, or read{" "}
        <Link href="/docs/how-it-works">how the pipeline is put together</Link>.
      </p>
    </DocsPage>
  );
}
