import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import type { OrganisationRole } from '@/lib/organisations';

interface OrganisationRolesTableProps {
  roles: OrganisationRole[];
  /** Accessible name: ranks or offices. */
  label: string;
}

/** An organisation's ranks or offices, highest first, with their permissions. */
export function OrganisationRolesTable({ roles, label }: OrganisationRolesTableProps) {
  const { t } = useTranslation();
  return (
    <DataTable<OrganisationRole>
      label={label}
      rows={roles}
      rowKey={(r) => r.id}
      empty={t('moderation.none')}
      columns={[
        {
          key: 'name',
          header: t('organisations.columns.name'),
          cell: (r) => (
            <span className="flex flex-wrap items-center gap-1.5">
              {r.name}
              {r.head && <Badge variant="outline">{t('organisations.leader')}</Badge>}
              {r.isDefault && <Badge variant="outline">{t('organisations.default')}</Badge>}
            </span>
          ),
        },
        {
          key: 'priority',
          header: t('organisations.columns.priority'),
          cell: (r) => r.priority,
          className: 'text-right tabular-nums',
        },
        {
          key: 'permissions',
          header: t('organisations.columns.permissions'),
          cell: (r) =>
            r.head ? (
              <span className="text-fg-2">{t('organisations.allPermissions')}</span>
            ) : r.permissions.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {r.permissions.map((p) => (
                  <MonoText key={p} tone="muted">
                    {p}
                  </MonoText>
                ))}
              </span>
            ) : (
              <span className="text-fg-3">—</span>
            ),
        },
      ]}
    />
  );
}
