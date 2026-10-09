import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/hooks/useCan';
import { ImportSearchSchema } from '@/lib/importSearch';
import { ImportPage } from '@/pages/ImportPage';

function ImportRoute() {
  const search = Route.useSearch();
  const { t } = useTranslation();
  const can = useCan();
  // The import only writes: without the right, say so rather than fail at the first item.
  if (!can('persistence.write')) {
    return (
      <p role="alert" className="p-6 text-sm text-fg-2">
        {t('session.noWriteRight')}
      </p>
    );
  }
  return <ImportPage search={search} />;
}

export const Route = createFileRoute('/import')({
  validateSearch: ImportSearchSchema,
  component: ImportRoute,
});
