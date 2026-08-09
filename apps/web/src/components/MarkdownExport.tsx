'use client';

import { useEffect, useRef, useState } from 'react';
import { toMarkdown, type MarkdownReport } from '@vibeguard/core';

/**
 * Copy or download the report as Markdown.
 *
 * Rendered entirely in the browser from data the page already has — no
 * endpoint, no new input reaching the backend, nothing added to the archive.
 * The renderer lives in packages/core so this and any future server-side export
 * cannot disagree about what the report says.
 */
export function MarkdownExport({ report }: { report: MarkdownReport }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(toMarkdown(report));
      setState('copied');
    } catch {
      // Insecure origins and permissions policies both block the clipboard.
      // Saying so beats a button that silently did nothing.
      setState('failed');
    }
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  function download() {
    const blob = new Blob([toMarkdown(report)], {
      type: 'text/markdown;charset=utf-8',
    });
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl.current;
    link.download = `vibeguard-${slug(report.repoUrl)}.md`;
    link.click();
  }

  return (
    <span className='inline-flex flex-wrap items-center gap-2'>
      <button
        type='button'
        onClick={copy}
        className='brut-btn-ghost px-3 py-1.5 text-[11px]'
      >
        {state === 'copied'
          ? 'Copied'
          : state === 'failed'
            ? 'Copy failed'
            : 'Copy as Markdown'}
      </button>
      <button
        type='button'
        onClick={download}
        className='brut-btn-ghost px-3 py-1.5 text-[11px]'
      >
        Download .md
      </button>
      <span role='status' aria-live='polite' className='sr-only'>
        {state === 'copied'
          ? 'Report copied to clipboard as Markdown'
          : state === 'failed'
            ? 'Copy failed'
            : ''}
      </span>
    </span>
  );
}

function slug(repoUrl: string): string {
  return (
    repoUrl
      .replace(/^https:\/\/github\.com\//i, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'report'
  );
}
