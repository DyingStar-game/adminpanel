import type { ReactNode } from 'react';

interface ObjectPageLayoutProps {
  header: ReactNode;
  headline: ReactNode;
  relations: ReactNode;
  children: ReactNode;
  properties: ReactNode;
  raw: ReactNode;
  /** Model schematic (ADR 0016), shown above the relations when the model has one. */
  schematic?: ReactNode;
  labels: {
    relations: string;
    children: string;
    properties: string;
    raw: string;
    schematic: string;
  };
}

/** Object page, laid out like every page: title and actions, then cards over the full width. */
export function ObjectPageLayout(props: ObjectPageLayoutProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-col gap-5 p-6">
        {props.header}
        {props.headline}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {props.schematic && (
              <Card title={props.labels.schematic} padded>
                {props.schematic}
              </Card>
            )}
            <Card title={props.labels.relations}>{props.relations}</Card>
          </div>
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
    <section aria-label={title} className="min-w-0 rounded-xl border bg-surface-2 pb-3">
      <h2 className="px-5 pt-4 pb-2 text-2xs font-semibold tracking-[0.15em] text-fg-3 uppercase">
        {title}
      </h2>
      <div className={padded ? 'px-5' : undefined}>{children}</div>
    </section>
  );
}
