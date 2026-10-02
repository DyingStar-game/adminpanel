import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
}

/**
 * Layout of the first DyingStar panel: fixed sidebar on the left, then the header and a content
 * area that owns its own scrolling.
 */
export function AppShell({ sidebar, topBar, children }: AppShellProps) {
  return (
    <div className="flex h-dvh bg-background text-foreground">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topBar}
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
