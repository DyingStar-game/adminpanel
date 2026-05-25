import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Single segment in the header breadcrumb trail. */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Horizontal breadcrumb navigation with optional links. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-ds-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} strokeWidth={1.5} />}
          {item.href ? (
            <Link to={item.href} className="hover:text-ds-text transition-all duration-150">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
