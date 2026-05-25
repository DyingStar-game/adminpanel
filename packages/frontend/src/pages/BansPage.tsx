import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Input,
  Label,
  Select,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/ui';
import { apiFetch } from '@/lib/api';
import type { BanRecord } from '@dyingstar/shared';
import { useServerId } from '@/hooks/useApi';
import { toast } from '@/stores/toastStore';

/** Quick ban form and table of active bans for the active server. */
export function BansPage() {
  const serverId = useServerId();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('permanent');

  const { data: bans = [] } = useQuery({
    queryKey: ['bans', serverId],
    queryFn: () => apiFetch<BanRecord[]>('/api/bans', { serverId }),
    enabled: Boolean(serverId),
  });

  const createBan = useMutation({
    mutationFn: () =>
      apiFetch<BanRecord>('/api/bans', {
        method: 'POST',
        serverId,
        body: JSON.stringify({
          userId: userId || crypto.randomUUID(),
          username,
          reason,
          bannedBy: 'admin',
          permanent: duration === 'permanent',
          expiresAt: duration === 'temp' ? new Date(Date.now() + 7 * 86400000).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success('Utilisateur banni');
      qc.invalidateQueries({ queryKey: ['bans'] });
      setUsername('');
      setReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const liftBan = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/bans/${id}`, { method: 'DELETE', serverId }),
    onSuccess: () => {
      toast.success('Ban levé');
      qc.invalidateQueries({ queryKey: ['bans'] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ds-text">Bannissements</h1>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-medium mb-4">Bannissement rapide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <Label>User ID (optionnel)</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Motif</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div>
              <Label>Durée</Label>
              <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="permanent">Permanent</option>
                <option value="temp">7 jours</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => createBan.mutate()} disabled={!username || !reason}>
                Bannir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-5 py-4 border-b border-ds-border">
          <h3 className="font-medium">Comptes bannis</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Username</TableHeader>
                <TableHeader>Motif</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Banni par</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <tbody>
              {bans.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.username}</TableCell>
                  <TableCell>{b.reason}</TableCell>
                  <TableCell className="text-ds-muted text-xs">
                    {new Date(b.bannedAt).toLocaleString('fr-FR')}
                  </TableCell>
                  <TableCell>{b.bannedBy}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => liftBan.mutate(b.id)}>
                      Lever le ban
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!bans.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-ds-muted text-center py-8">
                    Aucun bannissement
                  </TableCell>
                </TableRow>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-medium mb-2">Historique de modération</h3>
          <p className="text-sm text-ds-muted">
            Les actions sont enregistrées dans le journal d&apos;activité du dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
