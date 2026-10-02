import { createFileRoute } from '@tanstack/react-router';
import { ImportSearchSchema } from '@/lib/importSearch';
import { ImportPage } from '@/pages/ImportPage';

function ImportRoute() {
  const search = Route.useSearch();
  return <ImportPage search={search} />;
}

export const Route = createFileRoute('/import')({
  validateSearch: ImportSearchSchema,
  component: ImportRoute,
});
