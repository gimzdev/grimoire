import { ImageResponse } from 'next/og';
import { getClass } from '@/lib/data';
import { getNews, getNewsEntry, newsDay } from '@/lib/news';
import { clip, INK, OG_SIZE, OgFrame, ogFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'The day’s hotfixes: the date, the classes they touch and what changed, in short';

export function generateStaticParams() {
  return getNews().map((n) => ({ date: n.date }));
}

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const n = getNewsEntry(date);
  if (!n) return new Response('Not found', { status: 404 });
  const classes = n.classes.map((c) => getClass(c)?.name ?? c).join(', ');
  return new ImageResponse(
    (
      <OgFrame foot="WoW Forever hotfixes">
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <span style={{ fontSize: 26, fontWeight: 500, color: INK.giltBright }}>{clip(`${newsDay(n.date)}${classes ? ` · ${classes}` : ''}`, 78)}</span>
          <span style={{ fontSize: n.title.length > 30 ? 62 : 76, fontWeight: 600, lineHeight: 1.04, marginTop: 14, letterSpacing: -2 }}>{n.title}</span>
          <span style={{ fontSize: 28, lineHeight: 1.4, color: INK.parch, marginTop: 24, maxWidth: 1000 }}>{clip(n.description, 210)}</span>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}
