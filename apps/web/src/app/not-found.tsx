import Link from "next/link";
import { StateCard } from "@/components/StateCard";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <StateCard
        badge="404"
        title="Nothing here"
        body="That scan does not exist, or the link is wrong. Scans are identified by a UUID issued when the repository is submitted."
      >
        <Link href="/" className="brut-btn px-4 py-2 text-xs no-underline">
          Start a scan
        </Link>
      </StateCard>
    </main>
  );
}
