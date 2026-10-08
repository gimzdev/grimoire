import '@fontsource-variable/mona-sans/wdth.css';
import '@fontsource-variable/mona-sans/wdth-italic.css';
import '@fontsource/im-fell-english-sc/latin-400.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader, type HeaderData } from '@/components/site-header';
import { resolveArt } from '@/lib/art-server';
import { getClasses, getDungeons, getGuides, getMeta, getQuests, getSets, getZones } from '@/lib/data';
import { isLadderZone } from '@/lib/world';
import { TipLayer } from '@/components/tip-layer';
import { SITE, siteUrl } from '@/lib/site';

function metadataBase(): URL | undefined {
  try {
    return new URL(siteUrl());
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: { default: `${SITE.name}: WoW Forever guides, talents and database`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { siteName: SITE.name, type: 'website' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
};

export const viewport: Viewport = { themeColor: '#08090c', colorScheme: 'dark' };

/** Runs before pictures load: a game icon that fails shows its initials (see .wi[data-broken] in globals.css). */
const ICON_FALLBACK = `(function(){function f(e,b){var t=e.target;if(!t||t.tagName!=='IMG')return;if(b&&t.getAttribute('data-fallback')==='hide'){t.style.visibility='hidden';return}var p=t.parentNode;if(p&&p.classList&&p.classList.contains('wi')){if(b)p.setAttribute('data-broken','');else p.removeAttribute('data-broken')}}addEventListener('error',function(e){f(e,1)},true);addEventListener('load',function(e){f(e,0)},true)})()`;

/** What the header's menus show: classes, counts and featured guides, read once per render on the server. */
function headerData(): HeaderData {
  const meta = getMeta();
  const quests = getQuests();
  const guides = getGuides();
  const featured = ['getting-started', 'leveling', 'talents-overview', 'new-dungeons']
    .map((slug) => guides.find((g) => g.slug === slug))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  return {
    classes: getClasses().map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon, specs: c.specs.map((s) => s.name) })),
    counts: {
      items: meta.counts.items,
      itemsNew: meta.counts.itemsNew,
      quests: quests.length,
      questsNew: quests.filter((q) => q.ch === 'n').length,
      sets: getSets().length,
      zones: getZones().filter(isLadderZone).length,
      dungeons: getDungeons().filter((d) => d.kind === 'dungeon').length,
    },
    guides: featured.map((g) => ({ slug: g.slug, title: g.title, description: g.description, art: resolveArt(g.art ?? 'paintedVista').src })),
    classGuides: guides.filter((g) => g.category === 'Classes' && g.cls).map((g) => ({ slug: g.slug, cls: g.cls! })),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://wow.zamimg.com" />
        <script dangerouslySetInnerHTML={{ __html: ICON_FALLBACK }} />
      </head>
      <body className="min-h-dvh overflow-x-hidden">
        <a href="#main" className="fixed left-4 top-3 z-[60] -translate-y-24 rounded-full bg-gilt px-5 py-2.5 font-semibold text-[#1b1306] focus:translate-y-0">
          Skip to content
        </a>
        <SiteHeader data={headerData()} />
        <main id="main" className="min-h-[70vh]">
          {children}
        </main>
        <SiteFooter />
        <TipLayer />
      </body>
    </html>
  );
}
