/**
 * Grimoire's mark: a gold rune stone with a G cut into it, and the name in IM Fell English small capitals,
 * a revival of seventeenth-century English book type.
 * Drawn here as vector shapes, not taken from any game art.
 */

const G_RUNE = 'M41.5 24 L32 14.5 L18.5 28 L18.5 36 L32 49.5 L45.5 36 L45.5 31 L34.5 31';

/** The rune stone. Gradient ids are per placement so a hidden copy never breaks a visible one. */
export function Emblem({ size = 32, className = '', id = 'gr' }: { size?: number; className?: string; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffdb8a" />
          <stop offset="0.55" stopColor="#f2b640" />
          <stop offset="1" stopColor="#d48f22" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="40" height="40" rx="7.5" transform="rotate(45 32 32)" fill={`url(#${id}s)`} />
      <path d={G_RUNE} fill="none" stroke="#0b0c0f" strokeWidth="5.4" strokeLinejoin="miter" strokeLinecap="square" />
    </svg>
  );
}

/** The name with the stone beside it, for the header and the footer. */
export function Wordmark({ className = '', id = 'grw', size = 28 }: { className?: string; id?: string; size?: number }) {
  return (
    <span role="img" aria-label="Grimoire" className={`inline-flex items-center gap-2.5 ${className}`}>
      <Emblem size={size} id={id} />
      <span aria-hidden className="font-mark text-[24px] font-normal leading-none tracking-[0.03em] text-vellum">
        Grimoire
      </span>
    </span>
  );
}
