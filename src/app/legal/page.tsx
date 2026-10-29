import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui';
import { ACCOUNTS } from '@/lib/accounts';
import { neonRegion } from '@/lib/pgconfig.mjs';

export const metadata: Metadata = {
  title: 'Terms, privacy and credits',
  description: 'The terms of use of Grimoire, what it does with personal data, and where its World of Warcraft: Forever data comes from.',
  alternates: { canonical: '/legal' },
};

const SOURCE = 'https://github.com/gimzdev/grimoire';

const UPDATED = 'October 2026';
const PLACES: Record<string, string> = {
  'eu-central-1': 'Frankfurt, Germany',
  'eu-west-2': 'London, United Kingdom',
  'us-east-1': 'Virginia, United States',
  'us-east-2': 'Ohio, United States',
  'us-west-2': 'Oregon, United States',
  'ap-southeast-1': 'Singapore',
  'ap-southeast-2': 'Sydney, Australia',
  'sa-east-1': 'São Paulo, Brazil',
};

const A = ({ to, children }: { to: string; children: ReactNode }) => (
  <a href={to} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

/** PRIVACY_CONTACT, its email addresses and links made clickable. */
function Contact() {
  const c = (process.env.PRIVACY_CONTACT || '').trim();
  if (!c) return <>the owner of this site</>;
  return (
    <>
      {c.split(/(https?:\/\/[^\s,;<>]+|[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+)/g).map((part, i): ReactNode =>
        i % 2 === 0 ? part : part.includes('@') && !part.startsWith('http') ? <a key={i} href={`mailto:${part}`}>{part}</a> : <A key={i} to={part}>{part}</A>,
      )}
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
      <h2 id={`${id}-title`} className="text-[1.9rem] leading-tight text-vellum sm:text-[2.2rem]">
        {title}
      </h2>
      <div className="prose-grim mt-4">{children}</div>
    </section>
  );
}

export default function Legal() {
  const region = neonRegion(process.env.DATABASE_URL || '');
  const social = !!((process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) || (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET));
  const place = PLACES[region] ?? (region ? `the ${region} region` : 'the region chosen when the database was created');
  const toc = [
    ['terms', 'Terms of use'],
    ['credits', 'Credits'],
    ['privacy', 'Privacy'],
    ...(ACCOUNTS ? [['rights', 'Your rights']] : []),
  ];
  return (
    <Container className="pb-6 pt-10 sm:pt-14">
      <h1 className="text-[2.6rem] leading-none text-vellum sm:text-[3.4rem]">Terms, privacy and credits</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-mist">Last updated {UPDATED}.</p>
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 border-l border-white/[0.08]">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[15px] text-mist transition-colors hover:border-gilt hover:text-vellum">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-3xl space-y-16">
          <Section id="terms" title="Terms of use">
            <p>
              Grimoire is a free fan site for World of Warcraft: Forever, not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft and Warcraft are trademarks or registered trademarks of Blizzard Entertainment, Inc.
            </p>
            <p>It comes as is, with no warranty. The game data is from a pre-launch build and will change: check in game before you count on a number. Please don’t use the site for spam, flood it with automated requests or use it for anything illegal.</p>
            {ACCOUNTS && <p>Accounts are free, for people aged 16 or older, one per email address. What you save is shown to no one else. An account used for abuse may be closed.</p>}
          </Section>

          <Section id="credits" title="Credits">
            <ul>
              <li>
                Talents, abilities, racials and the Legacy perks and challenges: <A to="https://talentsforever.com">talentsforever.com</A>, under{' '}
                <A to="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</A>, reorganised by Grimoire.
              </li>
              <li>
                Forever’s quests, and where each creature and object stands on the map: <A to="https://www.curseforge.com/wow/addons/questdb">LibQuestDB</A> by Pimptasty (MIT), whose Classic facts come from{' '}
                <A to="https://github.com/cmangos/classic-db">CMaNGOS</A> (GPL-3.0).
              </li>
              <li>
                Classic’s quests, creatures, items, loot, flight masters and trainers: the <A to="https://github.com/vmangos/core">VMaNGOS</A> world database (GPL-2.0-or-later).
              </li>
              <li>The leveling routes: worked out by Grimoire from the two sources above.</li>
              <li>Fonts: Mona Sans and IM FELL English SC, under the SIL Open Font License.</li>
              <li>Game names, text, icons and art © Blizzard Entertainment, Inc.</li>
            </ul>
            <p>
              Grimoire’s code is free software under the <A to="https://www.gnu.org/licenses/gpl-3.0.html">GPL-3.0 or later</A>, on <A to={SOURCE}>GitHub</A>, where{' '}
              <A to={`${SOURCE}/blob/master/NOTICE.md`}>NOTICE.md</A> has the full notices. Something of yours here? Write to <Contact />.
            </p>
          </Section>

          {ACCOUNTS ? (
            <>
              <Section id="privacy" title="Privacy">
                <p>
                  Without an account, Grimoire keeps nothing about you: the Legacy planner and your recent searches stay in your browser. Ask for a sign-in code and your email address is kept with it until it is used or the daily clean-up removes it.
                </p>
                <p>With an account, it keeps:</p>
                <ul>
                  <li>
                    <strong>your email address</strong>, to sign you in;
                  </li>
                  <li>
                    <strong>what you save</strong>: each build’s name, link and dates, and the Legacy Challenges you tick;
                  </li>
                  <li>
                    <strong>your sign-in</strong>: one cookie with a matching record (30 days, renewed when you come back){social && ', plus a short-lived one while Google or Discord signs you in'}, and the six-digit code we email you (good for 10 minutes), stored scrambled;
                  </li>
                  <li>
                    <strong>abuse counters</strong>: requests per network, email address and account, stored scrambled and deleted within two days;
                  </li>
                  <li>
                    <strong>with Google or Discord</strong>, the identifier they give for you, to know you next time (no name, photo or tokens).
                  </li>
                </ul>
                <p>
                  Nothing else: no password, name, photo, IP address, advertising, analytics or profiling. It is used only to run your account and keep the service secure (the service you asked for, and our legitimate interest in security), and never sold or shared for advertising. It stays until you delete the account; an account unused for 24 months is deleted automatically. The cookie and what your browser keeps for the site (that you are signed in, a build waiting to be saved while you sign in, and the Legacy planner’s copy of your ticks with the account they belong to, forgotten when you sign out) are strictly necessary, so there is no consent banner.
                </p>
                <p>
                  <strong>Who handles it.</strong> {(process.env.PRIVACY_CONTACT || '').trim() ? <>The owner of this site (<Contact />) decides what is done with it.</> : 'The owner of this site decides what is done with it.'} <A to="https://vercel.com/legal/privacy-policy">Vercel</A> hosts the site and keeps standard request logs, <A to="https://neon.com/privacy-policy">Neon</A> stores the database in {place}, encrypted, <A to="https://resend.com/legal/privacy-policy">Resend</A> sends the sign-in email, and Google or Discord sign you in if you choose them. Some of them work in the United States, under standard contractual clauses. Game icons load from Blizzard’s icon server, which sees your IP address like any site you visit.
                </p>
              </Section>

              <Section id="rights" title="Your rights">
                <p>
                  At the bottom of your profile page you can download everything stored about you, or delete the account and all of it at once (the database’s short recovery history expires on its own). To correct, restrict or object to how it is used, write to <Contact />; to change your email address, make a new account and delete the old one.
                </p>
                <p>You can also complain to your data protection authority, such as the CNIL in France or the Commission d’accès à l’information in Quebec. Grimoire is not for children under 16.</p>
              </Section>
            </>
          ) : (
            <Section id="privacy" title="Privacy">
              <p>
                Grimoire never asks for or stores personal information. The Legacy planner and your recent searches stay in your browser, and the planners keep their state in the page address so you can share it. The host may keep standard request logs, such as IP addresses, for security. Game icons load from Blizzard’s icon server, which sees your IP address like any site you visit.
              </p>
            </Section>
          )}
        </div>
      </div>
    </Container>
  );
}
