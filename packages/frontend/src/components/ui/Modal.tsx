import { cn } from '@/lib/cn';
import { X } from 'lucide-react';
import { useEffect } from 'react';

/** Semi-transparent backdrop that closes the overlay on click. */
export function ModalOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-40"
      onClick={onClose}
      aria-hidden
    />
  );
}

/** Centered dialog with optional title and Escape-to-close. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <ModalOverlay onClose={onClose} />
      <div
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg',
          'bg-ds-surface border border-ds-border rounded-xl shadow-2xl',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-ds-border">
            <h2 className="text-lg font-semibold text-ds-text">{title}</h2>
            <button onClick={onClose} className="text-ds-muted hover:text-white transition-all duration-150">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </>
  );
}

/** Right-side slide-over panel for forms and detail views. */
export function SlidePanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <ModalOverlay onClose={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-ds-surface border-l border-ds-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ds-border">
          <h2 className="text-lg font-semibold text-ds-text">{title}</h2>
          <button onClick={onClose} className="text-ds-muted hover:text-white">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}
