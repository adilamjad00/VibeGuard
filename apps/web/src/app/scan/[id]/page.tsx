import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchScan, type Scan } from "@/lib/api";
import { LiveProgress } from "./LiveProgress";
import { ScanReport } from "@/components/ScanReport";
import { ScanHeader } from "@/components/ScanHeader";
import { StateCard } from "@/components/StateCard";

export const dynamic = "force-dynamic";

const IN_PROGRESS = new Set(["queued", "cloning", "scanning", "analyzing"]);

/**
 * One route, five terminal states: unreachable API, unknown scan, failed scan,
 * running scan, finished report. Each is rendered deliberately rather than
 * falling through to a blank page.
 */
export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let scan: Scan | null;
  try {
    scan = await fetchScan(id);
  } catch (err) {
    return (
      <Shell>
        <StateCard
          tone="block"
          badge="Unavailable"
          title="Could not load this scan"
          body={`The API did not answer: ${err instanceof Error ? err.message : String(err)}. The scan itself may still be running — reloading is safe.`}
        >
          <Link href={`/scan/${id}`} className="brut-btn px-4 py-2 text-xs no-underline">
            Retry
          </Link>
          <Link href="/" className="brut-btn-ghost px-4 py-2 text-xs no-underline">
            New scan
          </Link>
        </StateCard>
      </Shell>
    );
  }

  if (!scan) notFound();

  if (scan.status === "failed") {
    return (
      <Shell>
        <ScanHeader scan={scan} />
        <StateCard
          tone="block"
          badge="Scan failed"
          title="The pipeline could not complete this scan"
          body="Every scanner failed, or the repository could not be read. It may be private, missing, or larger than the scan limit. No partial score is shown, because a score built on nothing would imply the code was checked."
        >
          <Link href="/" className="brut-btn px-4 py-2 text-xs no-underline">
            Scan another repo
          </Link>
        </StateCard>
      </Shell>
    );
  }

  if (IN_PROGRESS.has(scan.status)) {
    // Rendered on the server so the page is never blank, then handed to a
    // client component that streams live phases over a WebSocket.
    return (
      <Shell>
        <ScanHeader scan={scan} />
        <LiveProgress scanId={scan.id} initialStatus={scan.status} />
      </Shell>
    );
  }

  return (
    <Shell>
      <ScanHeader scan={scan} />
      <ScanReport scan={scan} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell section-tight max-w-5xl space-y-8">{children}</main>
  );
}
