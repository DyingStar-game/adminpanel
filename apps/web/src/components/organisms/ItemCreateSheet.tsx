import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ErrorCode, UuidSchema, type Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { SpawnOffsets } from '@/components/molecules/SpawnOffsets';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDefinitions } from '@/hooks/queries';
import { useCreateItem } from '@/hooks/mutations';
import { useItemCheck } from '@/hooks/useItemCheck';
import { useSceneOptions } from '@/hooks/useScenes';
import { useWriteTarget } from '@/hooks/useWriteTarget';
import { ApiError } from '@/lib/api';
import { splitFindings } from '@/lib/findings';
import { dataFromRows, toRaw } from '@/lib/propertyForm';
import {
  offsetValid,
  spawnDistanceFor,
  spawnHeightFor,
  spawnNextTo,
  type OffsetKey,
  type Offsets,
} from '@/lib/spawn';
import { PropertiesSchema, type PropertiesFormValues } from '@/lib/propertyFormSchema';
import type { PlaceContext, SpawnContext } from '@/stores/itemActions';
import { CheckNotice } from './CheckNotice';
import { PropertiesEditor } from './PropertiesEditor';

interface ItemCreateSheetProps {
  /** Level the item is created in (`''` = root). */
  parentId: string;
  objectType?: string | undefined;
  /** Spawn next to an entity: position and yaw prefilled, relative to the shared parent. */
  spawn?: SpawnContext | undefined;
  /** Fixed place (clicked on the map): position and orientation prefilled. */
  place?: PlaceContext | undefined;
  onCreated: (item: Item) => void;
  onCancel: () => void;
}

const CreateFormSchema = z.object({
  objectType: z.string().min(1, 'type'),
  uuid: UuidSchema.or(z.literal('')).refine((v) => v !== '', 'uuid'),
  properties: PropertiesSchema,
});
type CreateFormValues = z.infer<typeof CreateFormSchema> & PropertiesFormValues;

/** Creates an item: type from the definitions, client UUID, properties (ADR 0004, 0015). */
export function ItemCreateSheet({
  parentId,
  objectType,
  spawn,
  place,
  onCreated,
  onCancel,
}: ItemCreateSheetProps) {
  const preset = spawn?.preset ?? place?.preset;
  const { t } = useTranslation();
  const definitions = useDefinitions();
  const create = useCreateItem();
  const { isProduction, server } = useWriteTarget();
  const [pending, setPending] = useState<Item | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(CreateFormSchema),
    defaultValues: {
      objectType: objectType ?? '',
      uuid: crypto.randomUUID(),
      properties: [
        { key: 'parent_id', kind: 'text', raw: preset?.parentId ?? parentId },
        { key: 'scenename', kind: 'text', raw: '' },
        { key: 'position', kind: 'vec3', raw: toRaw(preset?.position, 'vec3') },
        ...(preset
          ? [{ key: 'rotation', kind: 'vec3' as const, raw: toRaw(preset.rotation, 'vec3') }]
          : []),
      ],
    },
  });
  const selectedType = useWatch({ control: form.control, name: 'objectType' });
  const watchedUuid = useWatch({ control: form.control, name: 'uuid' });
  const rows = useWatch({ control: form.control, name: 'properties' });

  // Coherence check before creating (ADR 0022); the item as it stands, to offer "create anyway".
  const check = useItemCheck();
  const current = useMemo(() => {
    const data = dataFromRows(rows);
    return data ? { object_type: selectedType, object_uuid: watchedUuid, object_data: data } : null;
  }, [rows, selectedType, watchedUuid]);
  const { byKey, general } = splitFindings(
    check.findings,
    rows.map((row) => row.key),
  );

  // Spawn next to an entity: offsets default to the chosen type's ones (8 m / 1 m for a vehicle).
  const [rawOffsets, setRawOffsets] = useState<Partial<Record<OffsetKey, string>>>({});
  const offsets: Offsets = {
    distance: Number(rawOffsets.distance ?? spawnDistanceFor(selectedType || undefined)),
    height: Number(rawOffsets.height ?? spawnHeightFor(selectedType || undefined)),
  };
  /** Sets one property row, adding it back if the user removed it. */
  const setRow = useCallback(
    (key: string, kind: 'text' | 'vec3', raw: string) => {
      const rows = form.getValues('properties');
      const index = rows.findIndex((row) => row.key === key);
      if (index >= 0)
        form.setValue(`properties.${index}`, { key, kind, raw }, { shouldDirty: true });
      else form.setValue('properties', [...rows, { key, kind, raw }]);
    },
    [form],
  );
  // Placement follows the reference whenever the type or the offsets change.
  useEffect(() => {
    if (!spawn || !offsetValid(offsets.distance) || !offsetValid(offsets.height)) return;
    const preset = spawnNextTo(spawn.reference, offsets.distance, offsets.height);
    if (!preset) return;
    setRow('parent_id', 'text', preset.parentId);
    setRow('position', 'vec3', toRaw(preset.position, 'vec3'));
    setRow('rotation', 'vec3', toRaw(preset.rotation, 'vec3'));
  }, [spawn, offsets.distance, offsets.height, setRow]);
  const sceneOptions = useSceneOptions();
  const definition = definitions.data
    ? (definitions.data.definitions.find((d) => d.type === selectedType) ?? null)
    : undefined;

  const send = async (item: Item) => {
    try {
      const created = await create.mutateAsync(item);
      toast.success(t('editor.created'));
      onCreated(created);
    } catch (error) {
      if (error instanceof ApiError && error.code === ErrorCode.alreadyExists) {
        form.setError('uuid', { message: 'exists' });
      } else if (error instanceof ApiError && error.code === ErrorCode.unknownObjectType) {
        form.setError('objectType', { message: 'type' });
      } else {
        toast.error(error instanceof Error ? error.message : t('editor.failed'));
      }
    } finally {
      setPending(null);
    }
  };

  const submit = form.handleSubmit(async ({ objectType: type, uuid, properties }) => {
    const data = dataFromRows(properties);
    if (!data) return;
    const item: Item = { object_type: type, object_uuid: uuid, object_data: data };
    if ((await check.run({ item, mode: 'create' })) !== 'save') return;
    if (isProduction) setPending(item);
    else void send(item);
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={(e) => void submit(e)} className="flex h-full min-h-0 flex-col">
      <SheetHeader className="border-b">
        <SheetTitle>{t('editor.createTitle')}</SheetTitle>
        <SheetDescription>
          {t('editor.liveWarning', { server: server?.name ?? '' })}
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-type">object_type</Label>
            <Controller
              control={form.control}
              name="objectType"
              render={({ field }) => (
                <OptionSelect
                  label="object_type"
                  value={field.value || undefined}
                  placeholder={t('editor.pickType')}
                  options={(definitions.data?.definitions ?? []).map((d) => ({
                    value: d.type,
                    label: d.type,
                  }))}
                  onChange={field.onChange}
                  className="h-8 w-full font-mono"
                />
              )}
            />
            {errors.objectType && (
              <span role="alert" className="text-2xs text-destructive">
                {t('editor.errors.type')}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-uuid">object_uuid</Label>
            <div className="flex gap-1.5">
              <Input
                id="create-uuid"
                className="h-8 font-mono text-xs"
                {...form.register('uuid')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={t('editor.regenerate')}
                title={t('editor.regenerate')}
                onClick={() => form.setValue('uuid', crypto.randomUUID(), { shouldValidate: true })}
              >
                <RefreshCwIcon />
              </Button>
            </div>
            <MonoText tone="subtle" className="text-2xs">
              {t('editor.uuidHint')}
            </MonoText>
            {errors.uuid && (
              <span role="alert" className="text-2xs text-destructive">
                {errors.uuid.message === 'exists'
                  ? t('editor.errors.exists')
                  : t('editor.errors.uuid')}
              </span>
            )}
          </div>
          {place && (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-fg-2">
              {t('editor.placeHint', { label: place.label })}
            </p>
          )}
          {spawn && (
            <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2">
              <p className="text-xs text-fg-2">
                {t('editor.spawnHint', { label: spawn.nearLabel })}
              </p>
              <SpawnOffsets
                id="spawn"
                values={offsets}
                raw={rawOffsets}
                onChange={(key, value) => setRawOffsets((raw) => ({ ...raw, [key]: value }))}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">object_data</span>
            <PropertiesEditor
              // The editor only touches `properties`, which both forms share.
              control={form.control as unknown as Control<PropertiesFormValues>}
              errors={errors as FieldErrors<PropertiesFormValues>}
              definition={selectedType ? definition : null}
              sceneOptions={sceneOptions}
              objectType={selectedType || undefined}
              findings={byKey}
              // Picking a known scene fills the type when none is chosen yet.
              onScenePick={(option) => {
                if (!form.getValues('objectType') && option.objectType) {
                  form.setValue('objectType', option.objectType, { shouldValidate: true });
                }
              }}
            />
          </div>
        </div>
      </ScrollArea>
      <CheckNotice findings={check.findings} general={general} failed={check.failed} />
      <SheetFooter className="flex-row justify-end border-t">
        <MonoText tone="subtle" className="mr-auto self-center text-2xs">
          POST /items
        </MonoText>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('confirm.cancel')}
        </Button>
        <Button type="submit" disabled={create.isPending || check.checking}>
          {check.checking
            ? t('editor.checking')
            : check.confirming(current)
              ? t('editor.createAnyway')
              : t('editor.create')}
        </Button>
      </SheetFooter>
      <WriteConfirm
        open={!!pending}
        title={t('editor.productionTitle')}
        description={<p>{t('editor.productionBody', { server: server?.name ?? '' })}</p>}
        confirmLabel={t('editor.create')}
        cancelLabel={t('confirm.cancel')}
        onConfirm={() => pending && void send(pending)}
        onCancel={() => setPending(null)}
      />
    </form>
  );
}
