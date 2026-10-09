import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  /** 1-based page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** "1–50 of 262 · page 1 / 6 ‹ ›", as in the mock-up table footer. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center gap-2 text-xs text-fg-2">
      <span>
        {total === 0 ? t('pagination.empty') : t('pagination.range', { from, to, total })}
      </span>
      <span className="flex-1" />
      <MonoText tone="subtle">{t('pagination.page', { page, pages })}</MonoText>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={t('pagination.previous')}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={t('pagination.next')}
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
