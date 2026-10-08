import type { ReactNode } from 'react';
import { PageHeading } from '@/components/molecules/PageHeading';

interface ServicePageLayoutProps {
  title: string;
  /** Under the title: a lead sentence, badges, an id. */
  meta?: ReactNode;
  /** Main actions of the page, on the right of the title. */
  actions?: ReactNode;
  /** Before the title, e.g. a player's avatar. */
  leading?: ReactNode;
  children: ReactNode;
}

/**
 * Page of a game service (players, moderation, a player's sheet — ADR 0024): heading with its
 * actions, then the content, scrolling on its own. Layout only, no data (ADR 0014).
 */
export function ServicePageLayout({
  title,
  meta,
  actions,
  leading,
  children,
}: ServicePageLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
      <div className="flex items-start gap-4">
        {leading}
        <div className="min-w-0 flex-1">
          <PageHeading title={title} actions={actions}>
            {meta}
          </PageHeading>
        </div>
      </div>
      {children}
    </div>
  );
}
