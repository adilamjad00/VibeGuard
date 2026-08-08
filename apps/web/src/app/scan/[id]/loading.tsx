/** Shown while the server component fetches the scan. Mirrors the report's shape. */
export default function ScanLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading scan"
      className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 sm:py-14"
    >
      <div className="space-y-3">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-72 max-w-full" />
        <div className="skeleton h-4 w-56" />
      </div>

      <div className="brut border-2 border-line-strong p-5 sm:p-7">
        <div className="flex flex-col items-start gap-7 sm:flex-row sm:items-center">
          <div className="skeleton h-42 w-42 shrink-0 rounded-full" />
          <div className="w-full flex-1 space-y-3">
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-7 w-56 max-w-full" />
            <div className="skeleton h-4 w-full max-w-md" />
            <div className="skeleton h-4 w-full max-w-sm" />
          </div>
        </div>
        <div className="mt-7 grid gap-3 border-t-2 border-line pt-6 sm:grid-cols-2">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
      </div>

      <div className="grid gap-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="skeleton h-24" />
        ))}
      </div>
    </main>
  );
}
