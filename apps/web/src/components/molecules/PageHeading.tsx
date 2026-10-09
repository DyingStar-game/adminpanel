import type { ReactNode } from 'react';

interface PageHeadingProps {
  title: string;
  /** Main actions of the page, on the right (e.g. Add an item). */
  actions?: ReactNode;
  /** Text under the title. */
  children?: ReactNode;
}

/** Page title of the first DyingStar panel: large gold title, actions on the right. */
export function PageHeading({ title, actions, children }: PageHeadingProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-link">{title}</h1>
        <span className="flex-1" />
        {actions}
      </div>
      {children}
    </div>
  );
}
