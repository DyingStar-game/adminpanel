import type { ReactNode } from 'react';

interface ObjectPageLayoutProps {
  header: ReactNode;
  headline: ReactNode;
  relations: ReactNode;
  children: ReactNode;
  properties: ReactNode;
  raw: ReactNode;
  labels: { relations: string; children: string; properties: string; raw: string };
}

/** Object page from the mock-up (1c): centred column of cards on the dotted background. */
export function ObjectPageLayout(props: ObjectPageLayoutProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface-2">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-4.5 px-7 pt-5 pb-10">
        {props.header}
        {props.headline}
        <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card title={props.labels.relations}>{props.relations}</Card>
          <Card title={props.labels.properties}>{props.properties}</Card>
        </div>
        <Card title={props.labels.children} padded>
          {props.children}
        </Card>
        <Card title={props.labels.raw} padded>
          {props.raw}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  padded = false,
  children,
}: {
  title: string;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-[10px] border bg-background pb-3">
      <h2 className="px-4.5 pt-4 pb-2 text-[11px] font-medium tracking-[.06em] text-fg-3 uppercase">
        {title}
      </h2>
      <div className={padded ? 'px-4.5' : undefined}>{children}</div>
    </section>
  );
}
