'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Re-runs the scan for the same repository and navigates to the new result.
 *
 * Deliberately posts the repository URL through the ordinary `POST /scans`
 * path rather than adding a "re-scan this id" endpoint: that keeps the SSRF
 * allowlist and the rate limiter on exactly one route, and means a stored URL
 * gets re-validated rather than trusted because it was accepted once.
 */
export function RescanButton({ repoUrl }: { repoUrl: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'queueing'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function rescan() {
    setState('queueing');
    setError(null);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status}).`);
        setState('idle');
        return;
      }
      router.push(`/scan/${data.id}`);
    } catch {
      setError('Could not reach the API.');
      setState('idle');
    }
  }

  return (
    <span className='inline-flex flex-wrap items-center gap-2'>
      <button
        type='button'
        onClick={rescan}
        disabled={state === 'queueing'}
        className='brut-btn-ghost px-3 py-1.5 text-[11px]'
      >
        {state === 'queueing' ? 'Queueing…' : 'Re-scan this repo'}
      </button>
      {error ? (
        <span role='status' className='font-mono text-[11px] text-block'>
          {error}
        </span>
      ) : null}
    </span>
  );
}
