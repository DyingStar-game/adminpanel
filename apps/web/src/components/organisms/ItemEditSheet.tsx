import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dequal } from 'dequal';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  EditConflictDetailsSchema,
  ErrorCode,
  type EditConflict,
  type Item,
} from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDefinitions, useItem } from '@/hooks/queries';
import { useUpdateItem } from '@/hooks/mutations';
import { useWriteTarget } from '@/hooks/useWriteTarget';
import { ApiError } from '@/lib/api';
import { itemLabel } from '@/lib/itemLabel';
import { dataFromRows, editDiff, rowsFromData } from '@/lib/propertyForm';
import { EditFormSchema, type PropertiesFormValues } from '@/lib/propertyFormSchema';
import { PropertiesEditor } from './PropertiesEditor';

interface ItemEditSheetProps {
  uuid: string;
  onDone: () => void;
}

/** Edits an item: loads it, then edits from a frozen base while live keeps flowing. */
export function ItemEditSheet({ uuid, onDone }: ItemEditSheetProps) {
  const { t } = useTranslation();
  const query = useItem(uuid, { live: true });
  if (query.isPending) return <p className="p-6 text-sm text-fg-3">{t('inspector.loading')}</p>;
  if (!query.data)
    return <p className="p-6 text-sm text-fg-3">{t('inspector.notFound', { uuid })}</p>;
  return <EditForm base={query.data} latest={query.data} onDone={onDone} />;
}

function EditForm({
  base: initial,
  latest,
  onDone,
}: {
  base: Item;
  latest: Item;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  // The version the user started from: kept while live refreshes `latest` (ADR 0009).
  const [base] = useState(initial);
  const definitions = useDefinitions();
  const definition = definitions.data
    ? (definitions.data.definitions.find((d) => d.type === base.object_type) ?? null)
    : undefined;
  const { isProduction, server } = useWriteTarget();
  const update = useUpdateItem();
  const [pending, setPending] = useState<{
    changes: Record<string, unknown>;
    removed: string[];
  } | null>(null);
  const [conflicts, setConflicts] = useState<EditConflict[] | null>(null);

  const form = useForm<PropertiesFormValues>({
    resolver: zodResolver(EditFormSchema),
    defaultValues: { properties: rowsFromData(base.object_data) },
  });

  /** Keys the game saved since the editor opened. */
  const gameChanged = useMemo(() => {
    const keys = new Set([...Object.keys(base.object_data), ...Object.keys(latest.object_data)]);
    return new Set([...keys].filter((k) => !dequal(base.object_data[k], latest.object_data[k])));
  }, [base, latest]);

  const save = async (
    edit: { changes: Record<string, unknown>; removed: string[] },
    force = false,
  ) => {
    try {
      await update.mutateAsync({
        uuid: base.object_uuid,
        object_type: base.object_type,
        base: base.object_data,
        ...edit,
        force,
      });
      toast.success(t('editor.saved'));
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === ErrorCode.editConflict) {
        const details = EditConflictDetailsSchema.safeParse(error.details);
        setPending(edit);
        setConflicts(details.success ? details.data.conflicts : []);
        return;
      }
      toast.error(error instanceof Error ? error.message : t('editor.failed'));
    }
  };

  const submit = form.handleSubmit(({ properties }) => {
    const edited = dataFromRows(properties);
    if (!edited) return;
    const edit = editDiff(base.object_data, edited);
    if (Object.keys(edit.changes).length === 0 && edit.removed.length === 0) {
      toast(t('editor.noChange'));
      return;
    }
    if (isProduction) setPending(edit);
    else void save(edit);
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex h-full min-h-0 flex-col">
      <SheetHeader className="border-b">
        <SheetTitle className="flex items-center gap-2">
          <TypeDot objectType={base.object_type} shape="square" />
          {t('editor.editTitle', { label: itemLabel(base) })}
        </SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-col gap-1">
            <MonoText tone="subtle" className="text-[11px] break-all">
              {base.object_type} · {base.object_uuid}
            </MonoText>
            <span className="text-xs">
              {t('editor.liveWarning', { server: server?.name ?? '' })}
            </span>
          </div>
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <PropertiesEditor
            control={form.control}
            errors={form.formState.errors}
            definition={definition}
            gameChanged={gameChanged}
          />
        </div>
      </ScrollArea>
      <SheetFooter className="flex-row justify-end border-t">
        <MonoText tone="subtle" className="mr-auto self-center text-[11px]">
          PUT /items/{'{uuid}'}
        </MonoText>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('confirm.cancel')}
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {t('editor.save')}
        </Button>
      </SheetFooter>

      {/* Production server: one more confirmation before the write. */}
      <WriteConfirm
        open={!!pending && !conflicts}
        title={t('editor.productionTitle')}
        description={<p>{t('editor.productionBody', { server: server?.name ?? '' })}</p>}
        confirmLabel={t('editor.save')}
        cancelLabel={t('confirm.cancel')}
        onConfirm={() => pending && void save(pending)}
        onCancel={() => setPending(null)}
      />
      {/* The game changed keys the user edited meanwhile. */}
      <WriteConfirm
        open={!!conflicts}
        title={t('editor.conflictTitle')}
        description={
          <>
            <p>{t('editor.conflictBody')}</p>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {(conflicts ?? []).map((c) => (
                <li key={c.key}>
                  <strong>{c.key}</strong>: {JSON.stringify(c.base)} → {t('editor.game')}{' '}
                  {JSON.stringify(c.latest)} · {t('editor.mine')} {JSON.stringify(c.mine)}
                </li>
              ))}
            </ul>
          </>
        }
        confirmLabel={t('editor.overwrite')}
        cancelLabel={t('confirm.cancel')}
        destructive
        onConfirm={() => {
          const edit = pending;
          setConflicts(null);
          setPending(null);
          if (edit) void save(edit, true);
        }}
        onCancel={() => {
          setConflicts(null);
          setPending(null);
        }}
      />
    </form>
  );
}
