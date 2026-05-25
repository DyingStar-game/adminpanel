import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  Badge,
  Modal,
} from '@/components/ui';
import { WipBanner } from '@/components/WipBanner';
import { apiFetch } from '@/lib/api';
import type { Mission, MissionStatus, MissionType } from '@dyingstar/shared';
import { useServerId } from '@/hooks/useApi';
import { toast } from '@/stores/toastStore';

const TYPES: MissionType[] = ['exploration', 'combat', 'delivery', 'social'];
const STATUSES: MissionStatus[] = ['draft', 'active', 'completed', 'archived'];

/** CRUD UI for missions (WIP — backed by local JSON storage). */
export function MissionsPage() {
  const serverId = useServerId();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'exploration' as MissionType,
    status: 'draft' as MissionStatus,
    assignedTo: '',
  });

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ['missions', serverId],
    queryFn: () => apiFetch<Mission[]>('/api/missions', { serverId }),
    enabled: Boolean(serverId),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        objectives: editing?.objectives ?? [],
        rewards: editing?.rewards ?? [],
      };
      if (editing) {
        return apiFetch<Mission>(`/api/missions/${editing.id}`, {
          method: 'PUT',
          serverId,
          body: JSON.stringify(body),
        });
      }
      return apiFetch<Mission>('/api/missions', {
        method: 'POST',
        serverId,
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editing ? 'Mission mise à jour' : 'Mission créée');
      qc.invalidateQueries({ queryKey: ['missions'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/missions/${id}`, { method: 'DELETE', serverId }),
    onSuccess: () => {
      toast.success('Mission supprimée');
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const filtered = missions.filter((m) => {
    if (filterStatus && m.status !== filterStatus) return false;
    if (filterType && m.type !== filterType) return false;
    return true;
  });

  /** Opens the mission modal for a new record. */
  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', type: 'exploration', status: 'draft', assignedTo: '' });
    setModalOpen(true);
  };

  /** Opens the mission modal with fields filled from an existing mission. */
  const openEdit = (m: Mission) => {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description,
      type: m.type,
      status: m.status,
      assignedTo: m.assignedTo ?? '',
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <WipBanner message="⚠️ Fonctionnalité en développement — stockage local temporaire (data/missions.json)" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-ds-text">Missions</h1>
        <Button onClick={openCreate}>
          <Plus size={16} strokeWidth={1.5} />
          Nouvelle mission
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Tous les types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading ? (
            <p className="text-ds-muted">Chargement…</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>id</TableHeader>
                  <TableHeader>title</TableHeader>
                  <TableHeader>type</TableHeader>
                  <TableHeader>status</TableHeader>
                  <TableHeader>assignedTo</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <tbody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id.slice(0, 8)}…</TableCell>
                    <TableCell>{m.title}</TableCell>
                    <TableCell>
                      <Badge variant="info">{m.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === 'active' ? 'success' : 'default'}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.assignedTo ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(m)} className="text-ds-muted hover:text-ds-text">
                          <Pencil size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(m.id)}
                          className="text-ds-muted hover:text-ds-danger"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Éditer la mission' : 'Créer une mission'}
      >
        <div className="space-y-3">
          <div>
            <Label>Titre</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Description (markdown)</Label>
            <textarea
              className="w-full px-3 py-2 text-sm rounded-lg bg-ds-surface-elevated border border-ds-border min-h-[100px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as MissionType })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MissionStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Assigné à</Label>
            <Input
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => saveMutation.mutate()}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
