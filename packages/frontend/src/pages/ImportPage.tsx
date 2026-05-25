import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TruncatedUuid,
} from '@/components/ui';
import type { CreateItemRequest } from '@dyingstar/shared';
import { apiFetch } from '@/lib/api';
import { useServerId } from '@/hooks/useApi';
import { toast } from '@/stores/toastStore';

type ImportRow = CreateItemRequest & {
  _index: number;
  _status: 'ok' | 'conflict' | 'invalid' | 'missing_uuid';
  _error?: string;
  _overwrite?: boolean;
};

/** Loads existing item UUIDs from the API for conflict detection during import. */
async function fetchExistingUuids(serverId: string | null): Promise<Set<string>> {
  try {
    const data = await apiFetch<{ items: { object_uuid: string }[]; total: number }>(
      '/api/items?page=1&page_size=500',
      { serverId },
    );
    return new Set(data.items.map((i) => i.object_uuid));
  } catch {
    return new Set();
  }
}

/**
 * Validates and annotates each import row: missing type, UUID conflicts, auto-generated ids.
 */
function prepareRows(raw: CreateItemRequest[], existing: Set<string>): ImportRow[] {
  return raw.map((item, i) => {
    const uuid = item.object_uuid ?? crypto.randomUUID();
    const withUuid = { ...item, object_uuid: uuid };
    if (!item.object_type) {
      return { ...withUuid, _index: i + 1, _status: 'invalid' as const, _error: 'object_type manquant' };
    }
    if (!item.object_uuid) {
      const status = existing.has(uuid) ? 'conflict' : 'missing_uuid';
      return { ...withUuid, _index: i + 1, _status: status };
    }
    if (existing.has(uuid)) {
      return { ...withUuid, _index: i + 1, _status: 'conflict' };
    }
    return { ...withUuid, _index: i + 1, _status: 'ok' };
  });
}

/** Bulk JSON import with preview, conflict handling, and sequential API writes. */
export function ImportPage() {
  const serverId = useServerId();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{
    created: number;
    overwritten: number;
    skipped: number;
    errors: number;
  } | null>(null);

  /** Parses a dropped or selected JSON file and builds validated preview rows. */
  const handleFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as CreateItemRequest | CreateItemRequest[];
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const existing = await fetchExistingUuids(serverId);
        setRows(prepareRows(list, existing));
        setSummary(null);
      } catch (e) {
        toast.error('Fichier JSON invalide');
      }
    },
    [serverId],
  );

  /** Handles drag-and-drop of a JSON file onto the drop zone. */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  /** Toggles overwrite flag for a row in conflict state. */
  const toggleOverwrite = (index: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r._index === index ? { ...r, _overwrite: !r._overwrite } : r,
      ),
    );
  };

  /** POSTs or PUTs each importable row against the active server API. */
  const runImport = async () => {
    if (!serverId) return;
    setImporting(true);
    let created = 0,
      overwritten = 0,
      skipped = 0,
      errors = 0;
    const toImport = rows.filter(
      (r) => r._status === 'ok' || r._status === 'missing_uuid' || (r._status === 'conflict' && r._overwrite),
    );

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
      try {
        if (row._status === 'conflict' && row._overwrite && row.object_uuid) {
          await apiFetch(`/api/items/${row.object_uuid}`, {
            method: 'PUT',
            serverId,
            body: JSON.stringify({
              object_type: row.object_type,
              object_data: row.object_data,
            }),
          });
          overwritten++;
        } else {
          await apiFetch('/api/items', {
            method: 'POST',
            serverId,
            body: JSON.stringify(row),
          });
          created++;
        }
      } catch {
        if (row._status === 'conflict' && !row._overwrite) skipped++;
        else errors++;
      }
    }

    skipped += rows.filter((r) => r._status === 'conflict' && !r._overwrite).length;
    setSummary({ created, overwritten, skipped, errors });
    setImporting(false);
    toast.success(`Import terminé : ${created} créés`);
  };

  const importable = rows.filter(
    (r) => r._status !== 'invalid' && (r._status !== 'conflict' || r._overwrite),
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ds-text">Import JSON</h1>

      <Card
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-dashed"
      >
        <CardContent className="py-12 text-center">
          <Upload className="mx-auto text-ds-muted mb-3" size={32} strokeWidth={1.5} />
          <p className="text-ds-muted mb-4">Glissez un fichier .json ici</p>
          <label className="inline-block cursor-pointer">
            <span className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-ds-surface-elevated border border-ds-border text-gray-200 hover:bg-ds-surface-hover transition-all duration-150">
              Parcourir
            </span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          <div className="flex justify-between items-center">
            <Button onClick={runImport} disabled={importing || importable === 0}>
              Importer {importable} items
            </Button>
            {importing && (
              <div className="flex-1 mx-4 h-2 bg-ds-surface-elevated rounded overflow-hidden">
                <div
                  className="h-full bg-ds-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          <Card>
            <CardContent className="pt-5 overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>object_type</TableHeader>
                    <TableHeader>object_uuid</TableHeader>
                    <TableHeader>name</TableHeader>
                    <TableHeader>Statut</TableHeader>
                  </TableRow>
                </TableHead>
                <tbody>
                  {rows.map((row) => (
                    <TableRow key={row._index}>
                      <TableCell>{row._index}</TableCell>
                      <TableCell>{row.object_type}</TableCell>
                      <TableCell>
                        {row.object_uuid ? (
                          <TruncatedUuid uuid={row.object_uuid} />
                        ) : (
                          <Badge variant="warning">UUID manquant → auto</Badge>
                        )}
                      </TableCell>
                      <TableCell>{String(row.object_data?.name ?? '—')}</TableCell>
                      <TableCell>
                        {row._status === 'ok' && <Badge variant="success">OK</Badge>}
                        {row._status === 'missing_uuid' && (
                          <Badge variant="warning">UUID auto-généré</Badge>
                        )}
                        {row._status === 'conflict' && (
                          <button onClick={() => toggleOverwrite(row._index)}>
                            <Badge variant="danger">
                              Conflit {row._overwrite ? '(écraser)' : '(ignorer)'}
                            </Badge>
                          </button>
                        )}
                        {row._status === 'invalid' && (
                          <span title={row._error}>
                            <Badge variant="danger">Invalide</Badge>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          {summary && (
            <Card>
              <CardContent className="pt-5 text-sm">
                Résumé : {summary.created} créés, {summary.overwritten} écrasés, {summary.skipped}{' '}
                ignorés, {summary.errors} erreurs
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
