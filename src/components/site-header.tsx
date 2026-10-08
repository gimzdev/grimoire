'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { NAV, type NavItem } from '@/lib/site';
import { WowIcon } from './icon';
import { Wordmark } from './logo';
import { InlineSearch } from './inline-search';

export interface HeaderClass {
  slug: string;
  name: string;
  color: string;
  icon: string;
  specs: string[];
}
export interface HeaderGuide {
  slug: string;
  title: string;
  description: string;
  art: string;
}
export interface HeaderData {
  classes: HeaderClass[];
  counts: { items: number; itemsNew: number; quests: number; questsNew: number; sets: number; zones: number; dungeons: number };
  guides: HeaderGuide[];
  classGuides: { slug: string; cls: string }[];
}

type Key = NavItem['key'];
const fmt = (n: number) => n.toLocaleString('en-US');

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return scrolled;
}

export function SearchIcon({ className = 'size-[17px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className={`size-3 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden>
      <path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Menu contents ──────────────────────────────────────────────────────── */

function MenuHead({ title, text, href, link }: { title: string; text: string; href: string; link: string }) {
  return (
    <div className="flex items-end justify-between gap-6 px-2 pb-4">
      <div>
        <div className="font-display text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-vellum">{title}</div>
        <div className="mt-1 text-[14px] text-mist">{text}</div>
      </div>
      <Link href={href} className="shrink-0 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[13.5px] font-medium text-parch transition-colors hover:bg-white/[0.1] hover:text-vellum">
        {link}
      </Link>
    </div>
  );
}

function TalentsMenu({ data }: { data: HeaderData }) {
  return (
    <div className="w-[820px] p-5">
      <MenuHead title="Talent calculator" text="Every tree was rebuilt for Forever. Pick a class and plan yours." href="/classes" link="Compare the classes" />
      <ul className="grid grid-cols-3 gap-1">
        {data.classes.map((c) => (
          <li key={c.slug}>
            <Link href={`/talents/${c.slug}`} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.05]">
              <WowIcon icon={c.icon} size={38} name={c.name} />
              <span className="min-w-0">
                <span className="block text-[15.5px] font-semibold leading-tight" style={{ color: c.color }}>
                  {c.name}
                </span>
                <span className="block truncate text-[13px] text-fog group-hover:text-mist">{c.specs.join(', ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-1 border-t border-white/[0.06] pt-3 text-[14px]">
        {[
          ['/abilities', 'Trainer abilities by level'],
          ['/races', 'Races and racials'],
          ['/guides#classes', 'Class guides'],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-parch transition-colors hover:bg-white/[0.05] hover:text-vellum">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MenuLink({ href, icon, label, text }: { href: string; icon: string; label: string; text: ReactNode }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.05]">
      <WowIcon icon={icon} size={34} name={label} />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold leading-snug text-vellum">{label}</span>
        <span className="block text-[13px] leading-snug text-mist">{text}</span>
      </span>
    </Link>
  );
}

function DatabaseMenu({ data }: { data: HeaderData }) {
  const c = data.counts;
  const col = (title: string, children: ReactNode) => (
    <div>
      <div className="px-2 text-[13px] font-medium text-fog">{title}</div>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </div>
  );
  return (
    <div className="w-[820px] p-5">
      <MenuHead title="Database" text="Every item, quest, NPC and dungeon, with drop chances." href="/search" link="Search everything" />
      <div className="grid grid-cols-3 gap-4">
        {col(
          'Items',
          <>
            <MenuLink href="/items" icon="inv_chest_plate16" label="All items" text={`${fmt(c.items)} pieces of gear`} />
            <MenuLink href="/items?change=new" icon="inv_misc_gem_pearl_04" label="New in Forever" text={`${fmt(c.itemsNew)} items Classic never had`} />
            <MenuLink href="/sets" icon="inv_helmet_74" label="Item sets" text={`${fmt(c.sets)} sets and their bonuses`} />
          </>,
        )}
        {col(
          'Quests',
          <>
            <MenuLink href="/quests" icon="inv_misc_note_01" label="All quests" text={`${fmt(c.quests)} quests, givers and rewards`} />
            <MenuLink href="/quests?change=new" icon="inv_scroll_03" label="New quests" text={`${fmt(c.questsNew)} added for Forever`} />
            <MenuLink href="/tools/leveling" icon="inv_misc_map02" label="Quests by level" text="What to pick up at your level" />
          </>,
        )}
        {col(
          'World',
          <>
            <MenuLink href="/world" icon="inv_misc_map_01" label="Zones" text={`${fmt(c.zones)} leveling zones by level`} />
            <MenuLink href="/dungeons" icon="achievement_dungeon_classicdungeonmaster" label="Dungeons and raids" text={`${fmt(c.dungeons)} dungeons with boss loot`} />
            <MenuLink href="/races" icon="inv_elemental_primal_air" label="Races" text="Racials and new combinations" />
          </>,
        )}
      </div>
    </div>
  );
}

function GuidesMenu({ data }: { data: HeaderData }) {
  const byClass = new Map(data.classes.map((c) => [c.slug, c]));
  return (
    <div className="grid w-[860px] grid-cols-[1.45fr_1fr] gap-5 p-5">
      <div>
        <div className="px-2">
          <div className="font-display text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-vellum">Guides</div>
          <div className="mt-1 text-[14px] text-mist">Class builds, leveling and everything new in Forever.</div>
        </div>
        <ul className="mt-3 space-y-0.5">
          {data.guides.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="group flex gap-3.5 rounded-xl p-2 transition-colors hover:bg-white/[0.05]">
                <span className="relative h-[58px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-slate ring-1 ring-white/10">
                  <Image src={g.art} alt="" fill sizes="96px" quality={60} className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold leading-snug text-vellum">{g.title}</span>
                  <span className="line-clamp-2 text-[13px] leading-snug text-mist">{g.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/guides" className="ml-2 mt-2 inline-block rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[13.5px] font-medium text-parch transition-colors hover:bg-white/[0.1] hover:text-vellum">
          All guides
        </Link>
      </div>
      <div className="rounded-2xl bg-white/[0.025] p-3">
        <div className="px-2 pt-1 text-[13px] font-medium text-fog">Class guides</div>
        <ul className="mt-2 grid grid-cols-2 gap-x-1 gap-y-0.5">
          {data.classGuides.map((g) => {
            const c = byClass.get(g.cls);
            if (!c) return null;
            return (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[14.5px] font-semibold transition-colors hover:bg-white/[0.05]" style={{ color: c.color }}>
                  <WowIcon icon={c.icon} size={26} name={c.name} />
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ToolsMenu() {
  const tools = NAV.find((n) => n.key === 'tools')?.children ?? [];
  return (
    <div className="w-[620px] p-5">
      <MenuHead title="Planning tools" text="Gear, leveling, raids and Legacy perks, planned ahead." href="/tools" link="All tools" />
      <div className="grid grid-cols-2 gap-1">
        <MenuLink href="/talents" icon="ability_marksmanship" label="Talent calculator" text="Point order, sharing, presets" />
        {tools.map((t) => (
          <MenuLink key={t.href} href={t.href} icon={t.icon ?? 'inv_misc_questionmark'} label={t.label} text={t.description} />
        ))}
      </div>
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────────────────────── */

/**
 * A floating bar: frosted over the art at the top of a page, nearly solid once the page scrolls.
 * The header itself is transparent and 84px tall; pages that open with art slide under it.
 */
export function SiteHeader({ data }: { data: HeaderData }) {
  const scrolled = useScrolled();
  const path = usePathname();
  const [open, setOpen] = useState<Key | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mac, setMac] = useState(false);
  // Phones: the bar turns into a search field while searching.
  const [searching, setSearching] = useState(false);
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const headerRef = useRef<HTMLElement>(null);
  const deskInput = useRef<HTMLInputElement>(null);

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  useEffect(() => {
    setOpen(null);
    setMobile(false);
    setSearching(false);
  }, [path]);

  // Ctrl+K, Cmd+K or / puts the cursor in the search field; so does openSearch() from anywhere on the page.
  useEffect(() => {
    const focusSearch = (query?: string) => {
      setOpen(null);
      setMobile(false);
      if (query !== undefined) setSeed(query);
      if (window.matchMedia('(min-width: 768px)').matches) deskInput.current?.focus();
      else setSearching(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        focusSearch();
      }
    };
    const onOpen = (e: Event) => focusSearch(((e as CustomEvent).detail as string) || undefined);
    window.addEventListener('keydown', onKey);
    window.addEventListener('grimoire:search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('grimoire:search', onOpen);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  useEffect(() => {
    document.documentElement.style.overflow = mobile ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [mobile]);

  // On the front page the name takes you back to the top; anywhere else it opens the front page, which starts at the top.
  const toTop = useCallback(
    (e: ReactMouseEvent<HTMLAnchorElement>) => {
      if (path !== '/' || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      setOpen(null);
      setMobile(false);
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    },
    [path],
  );
  const hold = useCallback(() => clearTimeout(closeTimer.current), []);
  const release = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 180);
  }, []);

  const active = NAV.find((n) => n.owns.some((o) => path === o || path.startsWith(`${o}/`)))?.key;
  const solid = scrolled || mobile || open !== null;
  const menus: Partial<Record<Key, ReactNode>> = {
    talents: <TalentsMenu data={data} />,
    database: <DatabaseMenu data={data} />,
    guides: <GuidesMenu data={data} />,
    tools: <ToolsMenu />,
  };
  const iconButton = 'inline-flex size-10 items-center justify-center rounded-full bg-white/[0.07] text-parch ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:text-vellum';

  return (
    <header ref={headerRef} onMouseLeave={release} onMouseEnter={hold} className="sticky top-0 z-50 h-[84px] pt-5">
      <div className="relative mx-auto w-full max-w-[1320px] px-4 sm:px-6">
        <div
          className={`relative z-10 flex h-14 items-center rounded-full border pl-4 pr-2 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color] duration-300 sm:pl-5 ${
            solid ? 'border-white/[0.09] bg-[rgb(12_13_17/0.88)]' : 'border-white/[0.13] bg-[rgb(12_13_17/0.42)]'
          } shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_18px_44px_-20px_rgb(0_0_0/0.8)]`}
        >
          {searching && (
            <div className="flex flex-1 items-center gap-2 md:hidden">
              <InlineSearch variant="bar" className="flex-1" placeholder="Search items, quests, talents" autoFocus initialQuery={seed} onDone={() => setSearching(false)} />
              <button type="button" className={iconButton} aria-label="Close search" onClick={() => setSearching(false)}>
                <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                  <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          <Link href="/" onClick={toTop} className={`h-10 shrink-0 items-center rounded-full ${searching ? 'hidden md:flex' : 'flex'}`} aria-label="Grimoire, home">
            <Wordmark id="grh" size={27} />
          </Link>

          <nav aria-label="Main" className="ml-6 hidden items-center gap-0.5 lg:flex xl:ml-8">
            {NAV.map((n) => {
              const isOpen = open === n.key;
              const menu = menus[n.key];
              const cls = `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14.5px] font-[560] transition-colors ${
                isOpen ? 'bg-white/[0.09] text-vellum' : active === n.key ? 'bg-white/[0.07] text-vellum' : 'text-parch/90 hover:bg-white/[0.06] hover:text-vellum'
              }`;
              if (!menu) {
                return (
                  <Link key={n.key} href={n.href} className={cls} aria-current={active === n.key ? 'page' : undefined} onMouseEnter={() => setOpen(null)}>
                    {n.label}
                  </Link>
                );
              }
              return (
                <button
                  key={n.key}
                  type="button"
                  className={cls}
                  aria-expanded={isOpen}
                  aria-controls={`menu-${n.key}`}
                  onMouseEnter={() => (hold(), setOpen(n.key))}
                  onClick={() => setOpen((o) => (o === n.key ? null : n.key))}
                >
                  {n.label}
                  <Chevron open={isOpen} />
                </button>
              );
            })}
          </nav>

          <div className={`ml-auto items-center gap-2 ${searching ? 'hidden md:flex' : 'flex'}`}>
            <InlineSearch variant="bar" className="hidden w-[228px] md:flex" hint={mac ? '⌘K' : 'Ctrl K'} inputRef={deskInput} initialQuery={seed} />
            <button type="button" onClick={() => (setMobile(false), setSearching(true))} className={`${iconButton} md:hidden`} aria-label="Search">
              <SearchIcon className="size-[18px]" />
            </button>
            <button type="button" className={`${iconButton} lg:hidden`} aria-label={mobile ? 'Close menu' : 'Open menu'} aria-expanded={mobile} onClick={() => setMobile((m) => !m)}>
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                {mobile ? (
                  <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                ) : (
                  <path d="M4 7.5h12M4 12.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Menus drop from under the bar, aligned with its left edge. */}
        {open && menus[open] && (
          <div id={`menu-${open}`} className="absolute left-4 top-[calc(100%+8px)] z-10 hidden sm:left-6 lg:block" onMouseEnter={hold}>
            <div className="animate-menu overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0e1014] shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_40px_80px_-30px_rgb(0_0_0/0.95)]">
              {menus[open]}
            </div>
          </div>
        )}
      </div>

      {mobile && <MobileMenu data={data} onSearch={() => (setMobile(false), setSearching(true))} />}
    </header>
  );
}

function MobileMenu({ data, onSearch }: { data: HeaderData; onSearch: () => void }) {
  const section = (title: string, children: ReactNode) => (
    <section className="border-t border-white/[0.07] py-5">
      <div className="text-[1.15rem] font-semibold tracking-[-0.015em] text-vellum">{title}</div>
      <div className="mt-3">{children}</div>
    </section>
  );
  const links = (key: Key) =>
    (NAV.find((n) => n.key === key)?.children ?? []).map((c) => (
      <Link key={c.href + c.label} href={c.href} className="flex items-center gap-3 py-2 text-[15.5px] text-parch">
        {c.icon && <WowIcon icon={c.icon} size={28} name={c.label} />}
        {c.label}
      </Link>
    ));
  return (
    <div className="scroll-thin fixed inset-0 z-0 overflow-y-auto bg-abyss px-5 pb-12 pt-[96px] lg:hidden">
      <button type="button" onClick={onSearch} className="mb-5 flex h-12 w-full items-center gap-3 rounded-full bg-white/[0.06] px-5 text-left text-[15.5px] text-mist ring-1 ring-inset ring-white/[0.08]">
        <SearchIcon className="size-[18px]" />
        Search items, quests, talents and guides
      </button>
      {section(
        'Talents',
        <div className="grid grid-cols-3 gap-2">
          {data.classes.map((c) => (
            <Link key={c.slug} href={`/talents/${c.slug}`} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.035] px-1 py-3 text-[14px] font-semibold" style={{ color: c.color }}>
              <WowIcon icon={c.icon} size={36} name={c.name} />
              {c.name}
            </Link>
          ))}
        </div>,
      )}
      {section('Database', <div className="grid sm:grid-cols-2">{links('database')}</div>)}
      {section(
        'Guides',
        <div className="grid sm:grid-cols-2">
          {data.guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="py-2 text-[15.5px] text-parch">
              {g.title}
            </Link>
          ))}
          <Link href="/guides" className="py-2 text-[15.5px] font-semibold text-gilt">
            All guides
          </Link>
        </div>,
      )}
      {section('Tools', <div className="grid sm:grid-cols-2">{links('tools')}</div>)}
      <section className="border-t border-white/[0.07] py-5">
        <Link href="/forever" className="text-[1.15rem] font-semibold tracking-[-0.015em] text-vellum">
          What’s new in Forever
        </Link>
      </section>
    </div>
  );
}
