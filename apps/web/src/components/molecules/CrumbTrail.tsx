import { Fragment } from 'react';
import { TypeDot } from '@/components/atoms/TypeDot';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface Crumb {
  id: string;
  label: string;
  objectType: string;
}

interface CrumbTrailProps {
  /** Ancestors from the root down; the last crumb is the current item. */
  crumbs: Crumb[];
  onSelect: (id: string) => void;
}

/** Ancestors breadcrumb with type dots (ADR 0005). */
export function CrumbTrail({ crumbs, onSelect }: CrumbTrailProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.id}>
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage className="inline-flex items-center gap-1.5 font-medium">
                    <TypeDot objectType={crumb.objectType} className="size-1.5" />
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(crumb.id)}
                    className="inline-flex items-center gap-1.5 rounded px-1 text-fg-2 hover:bg-surface-3 hover:text-foreground"
                  >
                    <TypeDot objectType={crumb.objectType} className="size-1.5" />
                    {crumb.label}
                  </button>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
