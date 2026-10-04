import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ContextMenuItem {
  key: string;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  /** Red, for an action that removes something. */
  destructive?: boolean;
}

interface ContextMenuProps {
  /** Accessible name of the menu (what it acts on). */
  label: string;
  /** Where it opens, in pixels from its positioned container's top-left corner. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  /** Escape, or an item chosen (the menu closes before the item's action runs). */
  onClose: () => void;
}

/** Small menu opened at a place (a right click on a canvas), focused on its first item. */
export function ContextMenu({ label, x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="menu"
      aria-label={label}
      className="absolute z-[1100] flex min-w-44 flex-col rounded-md border bg-background p-1 text-sm shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          autoFocus={index === 0}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={cn(
            'flex items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none',
            item.destructive && 'text-destructive',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
