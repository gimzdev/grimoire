import { ImageResponse } from 'next/og';
import { getClass, getGuide, getGuides } from '@/lib/data';
import { clip, INK, OG_SIZE, OgFrame, ogFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'The guide’s title, what it covers and when it was last updated';

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return new Response('Not found', { status: 404 });
  const c = g.cls ? getClass(g.cls) : undefined;
  const updated = new Date(g.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return new ImageResponse(
    (
      <OgFrame color={c?.color ?? INK.gilt} foot="WoW Forever guides">
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <span style={{ fontSize: 26, fontWeight: 500, color: c?.color ?? INK.giltBright }}>
            {g.category} · updated {updated} · {g.readMinutes} min read
          </span>
          <span style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.02, marginTop: 14, letterSpacing: -2 }}>{g.title}</span>
          <span style={{ fontSize: 28, lineHeight: 1.4, color: INK.parch, marginTop: 24, maxWidth: 1000 }}>{clip(g.description, 210)}</span>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}
