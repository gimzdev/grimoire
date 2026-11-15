import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { Container } from '@/components/ui';
import { getClass } from '@/lib/data';
import { getNews, newsDay } from '@/lib/news';

export const metadata: Metadata = {
  title: 'WoW Forever hotfixes, day by day',
  description: 'Every World of Warcraft: Forever hotfix since launch, in short: what changed for each class, and the Grimoire builds it touches.',
  alternates: { canonical: '/news' },
};

export default function NewsPage() {
  const news = getNews();
  return (
    <div className="relative isolate">
      <Backdrop art="expanses" strength={0.32} height={420} />
      <Container className="relative pt-10">
        <header className="max-w-3xl">
          <h1 className="text-[2.4rem] leading-[1.05] text-vellum sm:text-[3rem]">Hotfixes, day by day</h1>
          <p className="mt-4 text-[17.5px] leading-relaxed text-parch">
            What Blizzard changed in Forever since launch, in short: for each class, and the Grimoire builds it touches. Each day links to Blizzard’s own notes.{' '}
            <a href="/feed.xml" className="text-gilt underline decoration-gilt/40 underline-offset-2 hover:text-gilt-bright">
              RSS feed
            </a>
            .
          </p>
        </header>
        <ol className="mt-10 max-w-3xl space-y-3">
          {news.map((n) => (
            <li key={n.date}>
              <Link href={`/news/${n.date}`} className="frame block px-5 py-4 transition-colors hover:border-white/[0.16]">
                <div className="text-[14px] text-mist">
                  <time dateTime={n.date}>{newsDay(n.date)}</time>
                  {n.classes.length > 0 && (
                    <span>
                      {' · '}
                      {n.classes.map((c, i) => (
                        <span key={c} style={{ color: getClass(c)?.color }}>
                          {i > 0 ? ', ' : ''}
                          {getClass(c)?.name ?? c}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[1.25rem] font-semibold text-vellum">{n.title}</div>
                <p className="mt-1 text-[15.5px] leading-relaxed text-parch">{n.description}</p>
              </Link>
            </li>
          ))}
        </ol>
      </Container>
    </div>
  );
}
