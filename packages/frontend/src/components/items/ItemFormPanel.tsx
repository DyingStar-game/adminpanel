import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import type { ItemResponse, ObjectData } from '@dyingstar/shared';
import { apiFetch } from '@/lib/api';
import { useServerId } from '@/hooks/useApi';
import { SlidePanel, Button, Input, Label, Textarea } from '@/components/ui';
import { toast } from '@/stores/toastStore';
import { useI18n } from '@/hooks/useI18n';

const schema = z.object({
  object_type: z.string().min(1, 'Type requis'),
  object_uuid: z.string().optional(),
  name: z.string().optional(),
  parent_id: z.string().optional(),
  scenename: z.string().optional(),
  pos_x: z.coerce.number().optional(),
  pos_y: z.coerce.number().optional(),
  pos_z: z.coerce.number().optional(),
  rot_x: z.coerce.number().optional(),
  rot_y: z.coerce.number().optional(),
  rot_z: z.coerce.number().optional(),
  raw_json: z.string(),
});

type FormValues = z.infer<typeof schema>;

/** Maps an API item (or empty create) into react-hook-form default values. */
function itemToForm(item?: ItemResponse): FormValues {
  const d = item?.object_data ?? {};
  const pos = d.position as { x?: number; y?: number; z?: number } | undefined;
  const rot = d.rotation as { x?: number; y?: number; z?: number } | undefined;
  const { name, parent_id, scenename, position, rotation, ...rest } = d;
  const object_data = item
    ? { name, parent_id, scenename, position, rotation, ...rest }
    : { name: '', parent_id: '', scenename: '' };
  return {
    object_type: item?.object_type ?? '',
    object_uuid: item?.object_uuid,
    name: String(name ?? ''),
    parent_id: String(parent_id ?? ''),
    scenename: String(scenename ?? ''),
    pos_x: pos?.x ?? 0,
    pos_y: pos?.y ?? 0,
    pos_z: pos?.z ?? 0,
    rot_x: rot?.x ?? 0,
    rot_y: rot?.y ?? 0,
    rot_z: rot?.z ?? 0,
    raw_json: JSON.stringify(object_data, null, 2),
  };
}

/** Builds `object_data` from form fields, merging parsed JSON when valid. */
function formToObjectData(v: FormValues): ObjectData {
  let extra: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(v.raw_json) as ObjectData;
    extra = parsed;
  } catch {
    /* fall back to structured fields when raw JSON is invalid */
  }
  return {
    ...extra,
    name: v.name || (extra.name as string | undefined),
    parent_id: v.parent_id || (extra.parent_id as string | undefined),
    scenename: v.scenename || (extra.scenename as string | undefined),
    position: { x: v.pos_x ?? 0, y: v.pos_y ?? 0, z: v.pos_z ?? 0 },
    rotation: { x: v.rot_x ?? 0, y: v.rot_y ?? 0, z: v.rot_z ?? 0 },
  };
}

interface ItemFormPanelProps {
  open: boolean;
  onClose: () => void;
  item?: ItemResponse;
  onSaved: () => void;
}

/** Slide-over form to create or edit a game item with bidirectional JSON sync. */
export function ItemFormPanel({ open, onClose, item, onSaved }: ItemFormPanelProps) {
  const { t } = useI18n();
  const serverId = useServerId();
  const isEdit = Boolean(item);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: itemToForm(item),
  });

  const objectType = watch('object_type');

  const { data: descriptor } = useQuery({
    queryKey: ['prop-descriptor', objectType],
    queryFn: () =>
      apiFetch<Record<string, unknown>>(`/api/prop-descriptors/${objectType}`, { serverId }),
    enabled: Boolean(objectType) && open,
  });

  useEffect(() => {
    reset(itemToForm(item));
  }, [item, open, reset]);

  // Keep raw_json in sync when structured fields change (skip raw_json to avoid loops).
  useEffect(() => {
    const sub = watch((v, { name }) => {
      if (!name || name === 'raw_json') return;
      try {
        const data = formToObjectData(v as FormValues);
        setValue('raw_json', JSON.stringify(data, null, 2));
        setJsonError(null);
      } catch {
        /* ignore sync errors during partial edits */
      }
    });
    return () => sub.unsubscribe();
  }, [watch, setValue]);

  /** Parses manual JSON edits and mirrors known keys back into structured inputs. */
  const onRawChange = (raw: string) => {
    setValue('raw_json', raw);
    try {
      const parsed = JSON.parse(raw) as ObjectData;
      if (parsed.name != null) setValue('name', String(parsed.name));
      if (parsed.parent_id != null) setValue('parent_id', String(parsed.parent_id));
      if (parsed.scenename != null) setValue('scenename', String(parsed.scenename));
      const pos = parsed.position as { x?: number; y?: number; z?: number } | undefined;
      const rot = parsed.rotation as { x?: number; y?: number; z?: number } | undefined;
      if (pos) {
        setValue('pos_x', pos.x ?? 0);
        setValue('pos_y', pos.y ?? 0);
        setValue('pos_z', pos.z ?? 0);
      }
      if (rot) {
        setValue('rot_x', rot.x ?? 0);
        setValue('rot_y', rot.y ?? 0);
        setValue('rot_z', rot.z ?? 0);
      }
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  /** Persists the item via POST (create) or PUT (update) for the active server. */
  const onSubmit = async (values: FormValues) => {
    if (jsonError) return;
    const object_data = formToObjectData(values);
    try {
      if (isEdit && item) {
        await apiFetch(`/api/items/${item.object_uuid}`, {
          method: 'PUT',
          serverId,
          body: JSON.stringify({ object_type: values.object_type, object_data }),
        });
        toast.success(t('toast.itemUpdated'));
      } else {
        await apiFetch('/api/items', {
          method: 'POST',
          serverId,
          body: JSON.stringify({
            object_type: values.object_type,
            object_uuid: values.object_uuid || undefined,
            object_data,
          }),
        });
        toast.success(t('toast.itemCreated'));
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? t('items.edit') : t('items.add')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>object_type</Label>
          <Input {...register('object_type')} disabled={isEdit} />
          {errors.object_type && (
            <p className="text-ds-danger text-xs mt-1">{errors.object_type.message}</p>
          )}
        </div>
        {isEdit && (
          <div>
            <Label>object_uuid</Label>
            <Input {...register('object_uuid')} disabled className="font-mono text-xs" />
          </div>
        )}
        {descriptor && (
          <p className="text-xs text-ds-muted">
            {t('items.descriptorLoaded')}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>name</Label>
            <Input {...register('name')} />
          </div>
          <div>
            <Label>parent_id</Label>
            <Input {...register('parent_id')} />
          </div>
          <div className="col-span-2">
            <Label>scenename</Label>
            <Input {...register('scenename')} />
          </div>
        </div>
        <div>
          <Label>position / rotation</Label>
          <div className="grid grid-cols-3 gap-2">
            <Input {...register('pos_x')} placeholder="pos x" />
            <Input {...register('pos_y')} placeholder="pos y" />
            <Input {...register('pos_z')} placeholder="pos z" />
            <Input {...register('rot_x')} placeholder="rot x" />
            <Input {...register('rot_y')} placeholder="rot y" />
            <Input {...register('rot_z')} placeholder="rot z" />
          </div>
        </div>
        <div>
          <Label>object_data (JSON)</Label>
          <Textarea
            {...register('raw_json')}
            onChange={(e) => onRawChange(e.target.value)}
            className="min-h-[200px]"
          />
          {jsonError && <p className="text-ds-danger text-xs mt-1">{jsonError}</p>}
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </SlidePanel>
  );
}
