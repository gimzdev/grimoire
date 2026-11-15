import { NextResponse, type NextRequest } from 'next/server';
import { search } from '@/lib/search';

export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80);
  return NextResponse.json({ groups: search(q, 6) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
