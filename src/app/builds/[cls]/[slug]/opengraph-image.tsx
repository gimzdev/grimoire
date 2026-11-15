import { ImageResponse } from 'next/og';
import { buildPage, buildSlug } from '@/lib/build-pages';
import { getBuilds } from '@/lib/data';
import { BUILD_GROUPS, buildGroup } from '@/lib/build-groups';
import { clip, INK, OG_SIZE, OgFrame, OgTrees, ogFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'The build’s three talent trees, with every point it spends';

export function generateStaticParams() {
  return getBuilds().map((b) => ({ cls: b.cls, slug: buildSlug(b) }));
}

export default async function Image({ params }: { params: Promise<{ cls: string; slug: string }> }) {
  const { cls, slug } = await params;
  const p = buildPage(cls, slug);
  if (!p) return new Response('Not found', { status: 404 });
  const { b, c, t, ranks, title } = p;
  const group = BUILD_GROUPS.find((g) => g.key === buildGroup(b.kind))!.label;
  return new ImageResponse(
    (
      <OgFrame color={c.color} foot="WoW Forever builds">
        <div style={{ display: 'flex', flexDirection: 'column', width: 420, marginRight: 36 }}>
          <span style={{ fontSize: 26, fontWeight: 500, color: c.color }}>
            {c.name} · {group}
          </span>
          <span style={{ fontSize: 58, fontWeight: 600, lineHeight: 1.04, marginTop: 10, letterSpacing: -1.5 }}>{title}</span>
          <span style={{ fontSize: 23, lineHeight: 1.35, color: INK.parch, marginTop: 20 }}>{clip(b.summary, 120)}</span>
          <span style={{ fontSize: 40, fontWeight: 600, color: INK.giltBright, marginTop: 'auto' }}>{b.points.join(' / ')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <OgTrees t={t} ranks={ranks} color={c.color} cell={34} />
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}
