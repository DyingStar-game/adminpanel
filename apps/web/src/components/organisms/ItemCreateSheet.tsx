import { useState } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ErrorCode, UuidSchema, type Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDefinitions } from '@/hooks/queries';
import { useCreateItem } from '@/hooks/mutations';
import { useSceneNames } from '@/hooks/useSceneNames';
import { useWriteTarget } from '@/hooks/useWriteTarget';
import { ApiError } from '@/lib/api';
import { dataFromRows, toRaw } from '@/lib/propertyForm';
import { PropertiesSchema, type PropertiesFormValues } from '@/lib/propertyFormSchema';
import type { SpawnContext } from '@/stores/itemActions';
import { PropertiesEditor } from './PropertiesEditor';

interface ItemCreateSheetProps {
  /** Level the item is created in (`''` = root). */
  parentId: string;
  objectType?: string | undefined;
  /** Spawn next to an entity: position and yaw prefilled, relative to the shared parent. */
  spawn?: SpawnContext | undefined;
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
  onCreated,
  onCancel,
}: ItemCreateSheetProps) {
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
        { key: 'parent_id', kind: 'text', raw: spawn?.preset.parentId ?? parentId },
        { key: 'scenename', kind: 'text', raw: '' },
        { key: 'position', kind: 'vec3', raw: toRaw(spawn?.preset.position, 'vec3') },
        ...(spawn
          ? [{ key: 'rotation', kind: 'vec3' as const, raw: toRaw(spawn.preset.rotation, 'vec3') }]
          : []),
      ],
    },
  });
  const selectedType = useWatch({ control: form.control, name: 'objectType' });
  const scenes = useSceneNames(selectedType || undefined);
  /** Puts a known scene in the `scenename` property (added back if the user removed it). */
  const pickScene = (scene: string) => {
    const rows = form.getValues('properties');
    const index = rows.findIndex((row) => row.key === 'scenename');
    if (index >= 0) form.setValue(`properties.${index}.raw`, scene, { shouldDirty: true });
    else form.setValue('properties', [...rows, { key: 'scenename', kind: 'text', raw: scene }]);
  };
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

  const submit = form.handleSubmit(({ objectType: type, uuid, properties }) => {
    const data = dataFromRows(properties);
    if (!data) return;
    const item: Item = { object_type: type, object_uuid: uuid, object_data: data };
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
              <span role="alert" className="text-[11px] text-destructive">
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
            <MonoText tone="subtle" className="text-[11px]">
              {t('editor.uuidHint')}
            </MonoText>
            {errors.uuid && (
              <span role="alert" className="text-[11px] text-destructive">
                {errors.uuid.message === 'exists'
                  ? t('editor.errors.exists')
                  : t('editor.errors.uuid')}
              </span>
            )}
          </div>
          {spawn && (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-fg-2">
              {t('editor.spawnHint', { label: spawn.nearLabel })}
            </p>
          )}
          {(scenes.data?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-fg-3">{t('editor.knownScenes')}</span>
              <div className="flex flex-wrap gap-1">
                {scenes.data?.slice(0, 8).map((scene) => (
                  <Button
                    key={scene}
                    type="button"
                    variant="outline"
                    size="xs"
                    className="max-w-full truncate font-mono"
                    title={scene}
                    onClick={() => pickScene(scene)}
                  >
                    {scene.split('/').at(-1)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">object_data</span>
            <PropertiesEditor
              // The editor only touches `properties`, which both forms share.
              control={form.control as unknown as Control<PropertiesFormValues>}
              errors={errors as FieldErrors<PropertiesFormValues>}
              definition={selectedType ? definition : null}
            />
          </div>
        </div>
      </ScrollArea>
      <SheetFooter className="flex-row justify-end border-t">
        <MonoText tone="subtle" className="mr-auto self-center text-[11px]">
          POST /items
        </MonoText>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('confirm.cancel')}
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {t('editor.create')}
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
