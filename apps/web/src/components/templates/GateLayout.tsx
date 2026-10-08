import type { ReactNode } from 'react';
import { BrandMark } from '@/components/atoms/BrandMark';

interface GateLayoutProps {
  /** Shown above the card, e.g. the language choice. */
  aside?: ReactNode;
  title: string;
  children: ReactNode;
}

/** Full-screen card shown before the app: sign-in, access denied (ADR 0023). */
export function GateLayout({ aside, title, children }: GateLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 text-foreground">
      <div className="flex justify-end py-4">{aside}</div>
      <main className="flex flex-1 items-start justify-center pt-[12vh]">
        <section
          aria-labelledby="gate-title"
          className="flex w-full max-w-sm flex-col gap-5 rounded-xl border bg-card p-6"
        >
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-sm font-semibold tracking-wide">DyingStar</span>
          </div>
          <h1 id="gate-title" className="text-lg font-semibold">
            {title}
          </h1>
          {children}
        </section>
      </main>
    </div>
  );
}
