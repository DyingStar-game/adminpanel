import { useToastStore } from '@/stores/toastStore';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Fixed stack of dismissible toast notifications (bottom-right). */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[280px]',
            t.type === 'success' && 'bg-ds-success/10 border-ds-success/40 text-ds-success',
            t.type === 'error' && 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger',
            t.type === 'info' && 'bg-ds-surface border-ds-border text-gray-200',
          )}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
