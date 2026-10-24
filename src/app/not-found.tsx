import Link from 'next/link';
import { ButtonLink, Container } from '@/components/ui';
import { Vista } from '@/components/vista';

export default function NotFound() {
  return (
    <>
      <Vista art="unknownPaths" title="This path leads nowhere" size="page">
        This page isn’t in the Grimoire. It may have moved, or the link may be old.
      </Vista>
      <Container className="pb-10">
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/">Back to the front page</ButtonLink>
          <ButtonLink href="/search" variant="ghost">
            Search the database
          </ButtonLink>
          <ButtonLink href="/talents" variant="ghost">
            Talent calculator
          </ButtonLink>
        </div>
        <p className="mt-6 text-[15px] text-mist">
          Looking for an item or talent? Press <kbd className="rounded-[6px] border border-ash/70 bg-slate px-1.5 text-[12px]">Ctrl K</kbd> and type its name, or browse the <Link href="/items" className="text-gilt hover:text-gilt-bright">item database</Link>.
        </p>
      </Container>
    </>
  );
}
