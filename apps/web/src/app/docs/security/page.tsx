import type { Metadata } from "next";
import { DocsPage } from "@/components/docs/DocsPage";

export const metadata: Metadata = {
  title: "Security — VibeGuard docs",
  description:
    "How VibeGuard handles the code you give it: repository handling, SSRF protection, secrets redaction, storage and prompt injection.",
};

export default function Page() {
  return (
    <DocsPage slug="security">
      <p>
        You are handing a security tool a repository, so it should be clear what that tool does with
        it. Everything below is enforced in the pipeline rather than promised in a policy.
      </p>

      <h2 id="repository-handling">Repository handling</h2>
      <p>
        <strong>Your code is never executed.</strong> There is no <code>npm install</code>, no build
        step and no lifecycle script. The repository is shallow-cloned into a temporary directory and
        read as text by three static tools. A malicious <code>postinstall</code> hook in a scanned
        repository never runs, because nothing ever installs it.
      </p>
      <p>
        <strong>Clones are disposable.</strong> The temporary directory is removed in a{" "}
        <code>finally</code> block when the scan ends, whether it succeeded or failed. Nothing about
        the clone survives the job.
      </p>
      <p>
        <strong>The cloning worker has no public ingress.</strong> It is the component that fetches
        arbitrary remote content, so it is the one with no subdomain, no exposed port and no route
        from the internet. It reaches the queue and the database over a private network only.
      </p>
      <p>
        <strong>Only findings persist.</strong> After a scan, what remains is the normalised findings
        in Postgres and the archived report in object storage. Your source is not stored.
      </p>

      <h2 id="ssrf-protection">SSRF protection</h2>
      <p>
        <code>POST /scans</code> is the trust boundary. Whatever it accepts, a private worker inside
        the network will later fetch — so it is an <strong>allowlist</strong>, not a sanitiser.
        Anything not positively recognised as a public GitHub repository is rejected.
      </p>
      <ul>
        <li>
          <strong>https only.</strong> <code>http://</code> is downgradeable;{" "}
          <code>git://</code>, <code>ssh://</code>, <code>file://</code> and{" "}
          <code>git+ext://</code> are remote-code or local-file reads wearing a URL.
        </li>
        <li>
          <strong>Host must be github.com.</strong> No internal hostnames, no IP literals, no cloud
          metadata endpoints.
        </li>
        <li>
          <strong>No credentials and no port.</strong> A userinfo section would be forwarded to the host
          by git; an explicit port is a redirection primitive.
        </li>
        <li>
          <strong>Exactly two path segments.</strong> <code>/owner/repo</code> and nothing deeper.
          Reserved GitHub paths that are not repositories are rejected by name.
        </li>
        <li>
          <strong>Rebuilt, not echoed.</strong> The URL that reaches the worker is reconstructed from
          the validated owner and repo, so no query string, fragment or casing trick survives.
        </li>
      </ul>
      <p>
        The endpoint is also rate limited per source IP, with the counter held in Valkey rather than
        process memory — an in-memory counter would be per-replica, silently multiplying the real
        limit by the number of API containers.
      </p>

      <h2 id="secrets-redaction">Secrets redaction</h2>
      <p>
        A tool that finds your secrets is holding your secrets, so where they travel matters more than
        usual.
      </p>
      <ul>
        <li>
          <strong>Masked before the model sees them.</strong> For findings in the secret category, the
          detected value is masked in the snippet before anything is sent to the API. The model gets
          enough context to explain the problem and none of the credential.
        </li>
        <li>
          <strong>Masked in the archive.</strong> Object storage holds the normalised, redacted report —
          not raw scanner output. Raw gitleaks output contains the detected values verbatim, and
          archiving that would turn the scanner into a disclosure channel.
        </li>
        <li>
          <strong>Masked in the UI.</strong> The snippet rendered on the report page is the same
          redacted one, so a screen-shared report does not leak what it just found.
        </li>
      </ul>
      <p>
        Redaction is not a reason to relax: if a real credential was committed to a public repository,
        treat it as compromised and rotate it. It was public before VibeGuard read it.
      </p>

      <h2 id="data-and-report-storage">Data and report storage</h2>
      <p>
        <strong>The report bucket is private and stays private.</strong> Reports contain the
        vulnerable code paths and secret locations found in someone&apos;s repository — anonymous read
        access would be the worst possible default.
      </p>
      <p>
        The download button does not make the object readable. It asks the API to mint a{" "}
        <strong>short-lived presigned URL</strong> for that one object, which expires shortly after
        signing. The bucket policy never changes.
      </p>
      <p>
        Scans are identified by a UUID. That id is validated before it is used anywhere — including
        before it is interpolated into a pub/sub channel name — so it cannot be used to reach a
        channel it should not.
      </p>
      <p>
        Every scan submitted to this deployment is visible on the home page&apos;s recent-scan list.
        Only public repositories can be scanned, so nothing private is exposed by that, but it is
        worth knowing before you scan something you would rather not have listed.
      </p>

      <h2 id="prompt-injection">Prompt injection</h2>
      <p>
        The explanation pass sends code from an untrusted repository to a language model. That code
        can contain instructions aimed at the model — and in testing, it did: the demo repository
        includes comments arguing that its hardcoded credentials are fake and should be ignored.
      </p>
      <p>Three things make that harmless:</p>
      <ol>
        <li>
          <strong>The snippet is framed as data.</strong> The system prompt states that the content is
          untrusted material to analyse, never instructions to follow.
        </li>
        <li>
          <strong>The model has no authority over the result.</strong> It cannot add, remove, re-rank or
          suppress a finding, and it cannot change the score — which was already computed before it ran.
          The worst a successful injection achieves is a misleading paragraph of prose next to a finding
          that is still there, still counted and still severe.
        </li>
        <li>
          <strong>The output is validated.</strong> Responses are parsed against a schema and matched
          back to known findings; anything that does not match is discarded.
        </li>
      </ol>
      <p>
        This is the reason the architecture puts scoring before enrichment. It is not that the prompt
        is unbreakable — it is that breaking it does not get you anything.
      </p>
    </DocsPage>
  );
}
