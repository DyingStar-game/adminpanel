import type { ReactNode } from 'react';

interface AppShellProps {
  topBar: ReactNode;
  children: ReactNode;
}

/** Full-height layout: top bar and a content area that owns its own scrolling. */
export function AppShell({ topBar, children }: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {topBar}
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
