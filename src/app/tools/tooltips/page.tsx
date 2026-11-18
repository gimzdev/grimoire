import type { Metadata } from 'next';
import Script from 'next/script';
import { Backdrop } from '@/components/backdrop';
import { CopyCode } from '@/components/copy-code';
import { Container, Panel } from '@/components/ui';

export const metadata: Metadata = {
  title: 'WoW Forever tooltips for your site',
  description: 'One script tag and every link to a Grimoire item, quest or NPC on your guild site shows its tooltip, as in game. Free, with nothing stored.',
  alternates: { canonical: '/tools/tooltips' },
};

const LIVE = 'https://wowgrimoire.app';
const EXAMPLES: [string, string][] = [
  ['/items/19019', 'Thunderfury, Blessed Blade of the Windseeker'],
  ['/items/812', 'Glowing Brightwood Staff'],
  ['/quests/176', 'Wanted: "Hogger"'],
  ['/npcs/10184', 'Onyxia'],
];

export default function TooltipsPage() {
  return (
    <div className="relative isolate">
      <Backdrop art="camp" strength={0.35} height={480} />
      <Container className="relative pt-10">
        <header className="max-w-3xl">
          <h1 className="text-[2.4rem] leading-[1.05] text-vellum sm:text-[3rem]">Tooltips for your site</h1>
          <p className="mt-4 text-[17.5px] leading-relaxed text-parch">
            One script tag, and every link to a Grimoire item, quest or NPC on your guild site, forum or blog shows its tooltip on hover, the way the game shows it. Free, like the rest of
            Grimoire.
          </p>
        </header>

        <section className="mt-10 max-w-3xl" aria-labelledby="how">
          <h2 id="how" className="text-[1.7rem] text-vellum">
            1. Add this to your page
          </h2>
          <p className="mt-1 mb-4 text-mist">Anywhere in the page, once. It loads after your page and changes nothing on it.</p>
          <CopyCode code={`<script src="${LIVE}/tooltips.js" async></script>`} />
        </section>

        <section className="mt-10 max-w-3xl" aria-labelledby="link">
          <h2 id="link" className="text-[1.7rem] text-vellum">
            2. Link as usual
          </h2>
          <p className="mt-1 mb-4 text-mist">Copy the address of any item, quest or NPC page on Grimoire. Hover these:</p>
          <Panel className="space-y-2 p-5 text-[16.5px]">
            {EXAMPLES.map(([path, label]) => (
              <div key={path}>
                <a href={`${LIVE}${path}`} className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 hover:decoration-gilt">
                  {label}
                </a>
                <span className="block break-all font-mono text-[13.5px] text-fog sm:ml-3 sm:inline">{`${LIVE}${path}`}</span>
              </div>
            ))}
          </Panel>
        </section>

        <section className="mt-10 max-w-3xl space-y-3 text-[16px] leading-relaxed text-parch" aria-labelledby="more">
          <h2 id="more" className="text-[1.7rem] text-vellum">
            What it does
          </h2>
          <p>It shows the tooltip when a pointer rests on a link, or when the keyboard reaches it, and hides it when you move on or press Escape. On a touch screen a tap simply opens the link.</p>
          <p>Your links keep going to Grimoire, where the full page has the drops, the quests and the map. The script sets no cookie, stores nothing and counts nothing.</p>
          <p>The tooltips follow Grimoire’s data, so they change when the game does.</p>
        </section>
      </Container>
      {/* the demo links point at the live site, as on a guild page; the script comes from this server */}
      <Script src="/tooltips.js" strategy="afterInteractive" />
    </div>
  );
}
