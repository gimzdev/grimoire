'use client';
import { useState } from 'react';

/** A line of code to paste somewhere else, with a button that copies it. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="frame flex flex-wrap items-center gap-3 p-3 pl-4">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[14.5px] text-parch">{code}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
        className="h-9 shrink-0 rounded-full bg-white/[0.07] px-4 text-[14px] font-semibold text-vellum ring-1 ring-inset ring-white/[0.12] hover:bg-white/[0.12]"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
