import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  Badge,
  Modal,
} from '@/components/ui';
import { apiFetch } from '@/lib/api';
import type { AdminUser } from '@dyingstar/shared';
import { useServerId } from '@/hooks/useApi';
import { toast } from '@/stores/toastStore';

const ALL_ROLES = ['admin', 'moderator', 'player', 'developer'];

/** Admin user list with role editing and enable/disable toggles. */
export function UsersPage() {
  const serverId = useServerId();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [rolesModal, setRolesModal] = useState<AdminUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', serverId],
    queryFn: () =>
      apiFetch<{ users: AdminUser[]; keycloakConfigured: boolean }>('/api/admin/users', {
        serverId,
      }),
    enabled: Boolean(serverId),
  });

  const rolesMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/admin/users/${rolesModal!.id}/roles`, {
        method: 'PUT',
        serverId,
        body: JSON.stringify({ roles: selectedRoles }),
      }),
    onSuccess: () => {
      toast.success('Rôles mis à jour');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setRolesModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch(`/api/admin/users/${id}/enabled`, {
        method: 'PUT',
        serverId,
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users = (data?.users ?? []).filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ds-text">Comptes & Droits</h1>

      {!data?.keycloakConfigured && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-ds-border bg-ds-surface-elevated text-sm text-ds-muted">
          <Info size={16} strokeWidth={1.5} />
          Keycloak non configuré — définissez KEYCLOAK_ADMIN_SECRET dans le backend. Données de démo affichées.
        </div>
      )}

      <Input
        placeholder="Rechercher par username ou email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Card>
        <CardContent className="pt-5">
          {isLoading ? (
            <p className="text-ds-muted">Chargement…</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Utilisateur</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Rôles</TableHeader>
                  <TableHeader>Statut</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <tbody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-ds-accent/20 text-ds-text flex items-center justify-center text-xs font-semibold">
                          {u.username.slice(0, 2).toUpperCase()}
                        </span>
                        {u.username}
                      </div>
                    </TableCell>
                    <TableCell className="text-ds-muted">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="info">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.enabled ? 'success' : 'danger'}>
                        {u.enabled ? 'Actif' : 'Désactivé'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setRolesModal(u);
                            setSelectedRoles([...u.roles]);
                          }}
                        >
                          Rôles
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggleEnabled.mutate({ id: u.id, enabled: !u.enabled })
                          }
                        >
                          {u.enabled ? 'Désactiver' : 'Activer'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(rolesModal)}
        onClose={() => setRolesModal(null)}
        title={`Rôles — ${rolesModal?.username}`}
      >
        <div className="space-y-2">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedRoles([...selectedRoles, role]);
                  else setSelectedRoles(selectedRoles.filter((r) => r !== role));
                }}
              />
              {role}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setRolesModal(null)}>
            Annuler
          </Button>
          <Button onClick={() => rolesMutation.mutate()}>Enregistrer</Button>
        </div>
      </Modal>
    </div>
  );
}
