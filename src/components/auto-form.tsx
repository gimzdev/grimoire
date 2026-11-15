'use client';

import { useRouter } from 'next/navigation';
import { useRef, type ReactNode } from 'react';

/** A GET form that applies itself as filters change (and still works without JavaScript via its submit button). */
export function AutoForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const apply = (delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const form = ref.current;
      if (!form) return;
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form).entries()) {
        if (typeof v === 'string' && v !== '') params.append(k, v);
      }
      params.delete('page');
      router.replace(`${action}${params.size ? `?${params}` : ''}`, { scroll: false });
    }, delay);
  };
  return (
    <form
      ref={ref}
      action={action}
      method="get"
      className={className}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        apply(t.type === 'search' || t.type === 'number' ? 350 : 0);
      }}
      onInput={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.type === 'search') apply(350);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      {children}
    </form>
  );
}
