import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Role } from '@dyingstar-admin/contracts/npc';
import { LabelledField } from '@/components/molecules/LabelledField';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/useCan';
import { usePatchNpc } from '@/hooks/useNpcActions';
import { usePatterns, useTaskKinds } from '@/hooks/useNpcs';
import { cn } from '@/lib/cn';
import {
  ConfigFormSchema,
  configFormValues,
  configPatch,
  PLACE_FIELDS,
  writeError,
  type ConfigForm,
  type NpcFormError,
  type PlaceField,
  type Npc,
} from '@/lib/npcs';

const ROLES: Role[] = ['unassigned', 'storekeeper', 'villager', 'custom'];
const NONE = '__none__';

/**
 * An NPC's configuration (ADR 0031), hot-pushed to its runtime: names (the in-game name follows
 * at its next connection), enabled, role (set by hand it is locked unless `unassigned`),
 * village and storekeeper slot, shift pattern, action profile, its four places (an object's
 * UUID and a position local to it), per-action timing and config as JSON. Only the fields
 * changed are sent; the service's refusals are shown as it words them. Read only without
 * `npc.manage`.
 */
export function NpcConfigForm({ npc }: { npc: Npc }) {
  const { t } = useTranslation();
  const can = useCan();
  const manage = can('npc.manage');
  const patterns = usePatterns();
  const kinds = useTaskKinds();
  const patch = usePatchNpc();
  const [refused, setRefused] = useState<string | null>(null);
  const form = useForm<ConfigForm>({
    resolver: zodResolver(ConfigFormSchema),
    defaultValues: configFormValues(npc),
    mode: 'onChange',
    disabled: !manage,
  });
  const values = useWatch({ control: form.control }) as ConfigForm;
  const errors = form.formState.errors;
  const message = (code: string | undefined) =>
    code ? t(`npcs.errors.${code as NpcFormError}`) : undefined;
  const changes = form.formState.isValid ? configPatch(npc, values) : {};
  const actions = [
    ...new Set([...(kinds.data?.actions ?? []), ...npc.actionProfile, ...values.actionProfile]),
  ].sort();

  const submit = form.handleSubmit(async (valid) => {
    setRefused(null);
    try {
      const saved = await patch.mutateAsync({ id: npc.id, patch: configPatch(npc, valid) });
      toast.success(t('npcs.config.saved', { name: saved?.npc.displayName ?? npc.displayName }));
      if (saved) form.reset(configFormValues(saved.npc));
    } catch (error) {
      const text = writeError(error, t('npcs.unavailable'));
      setRefused(text);
      toast.error(text);
    }
  });

  const text = (field: 'firstName' | 'lastName' | 'villageCode', label: string, hint?: string) => (
    <LabelledField
      id={`config-${field}`}
      label={label}
      hint={hint}
      error={message(errors[field]?.message)}
      className="w-48"
    >
      <Input
        id={`config-${field}`}
        aria-invalid={!!errors[field]}
        aria-describedby={`config-${field}-message`}
        {...form.register(field)}
      />
    </LabelledField>
  );
  const toggle = (field: 'enabled' | 'roleLocked', label: string) => (
    <div className="flex items-center gap-2">
      <Controller
        control={form.control}
        name={field}
        render={({ field: f }) => (
          <Switch
            id={`config-${field}`}
            checked={f.value}
            disabled={!manage}
            onCheckedChange={f.onChange}
          />
        )}
      />
      <Label htmlFor={`config-${field}`}>{label}</Label>
    </div>
  );
  const place = (field: PlaceField) => {
    const id = (part: string) => `config-${field}-${part}`;
    const placeErrors = errors[field];
    const coordinate = (axis: 'x' | 'y' | 'z') => (
      <LabelledField
        key={axis}
        id={id(axis)}
        label={axis}
        error={message(placeErrors?.[axis]?.message)}
        className="w-24"
      >
        <Input
          id={id(axis)}
          type="number"
          step="any"
          aria-label={t('npcs.config.coordinate', { place: t(`npcs.places.${field}`), axis })}
          aria-describedby={`${id(axis)}-message`}
          {...form.register(`${field}.${axis}`, { valueAsNumber: true })}
        />
      </LabelledField>
    );
    return (
      <fieldset key={field} className="flex flex-col gap-2 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold">{t(`npcs.places.${field}`)}</legend>
        <div className="flex flex-wrap items-end gap-3">
          <LabelledField
            id={id('uuid')}
            label={t('npcs.config.placeUuid')}
            error={message(placeErrors?.uuid?.message)}
            className="min-w-72 flex-1"
          >
            <Input
              id={id('uuid')}
              className="font-mono text-xs"
              aria-label={t('npcs.config.placeUuidOf', { place: t(`npcs.places.${field}`) })}
              aria-describedby={`${id('uuid')}-message`}
              {...form.register(`${field}.uuid`)}
            />
          </LabelledField>
          <LabelledField id={id('planet')} label={t('npcs.config.planet')} className="w-32">
            <Input id={id('planet')} {...form.register(`${field}.planet`)} />
          </LabelledField>
          {coordinate('x')}
          {coordinate('y')}
          {coordinate('z')}
          {manage && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('npcs.config.clearPlace', { place: t(`npcs.places.${field}`) })}
              onClick={() =>
                form.setValue(
                  field,
                  { uuid: '', planet: '', x: Number.NaN, y: Number.NaN, z: Number.NaN },
                  { shouldDirty: true, shouldValidate: true },
                )
              }
            >
              {t('npcs.config.clear')}
            </Button>
          )}
        </div>
      </fieldset>
    );
  };
  const json = (field: 'actionTiming' | 'actionConfig', hint: string) => (
    <LabelledField
      id={`config-${field}`}
      label={t(`npcs.fields.${field}`)}
      hint={hint}
      error={message(errors[field]?.message)}
    >
      <Textarea
        id={`config-${field}`}
        rows={6}
        spellCheck={false}
        className="font-mono text-xs"
        aria-invalid={!!errors[field]}
        aria-describedby={`config-${field}-message`}
        {...form.register(field)}
      />
    </LabelledField>
  );

  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-label={t('npcs.config.title')}
      className="flex flex-col gap-5"
    >
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t('npcs.config.identity')}</h3>
        <div className="flex flex-wrap gap-3">
          {text('firstName', t('npcs.fields.firstName'))}
          {text('lastName', t('npcs.fields.lastName'), t('npcs.config.renameHint'))}
        </div>
        {toggle('enabled', t('npcs.fields.enabled'))}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t('npcs.config.assignment')}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <LabelledField
            id="config-role"
            label={t('npcs.fields.role')}
            hint={t('npcs.config.roleHint')}
          >
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <OptionSelect<Role>
                  size="default"
                  label={t('npcs.fields.role')}
                  value={field.value}
                  options={ROLES.map((r) => ({ value: r, label: t(`npcs.roles.${r}`) }))}
                  onChange={(v) => {
                    field.onChange(v);
                    // As the service does: a role set by hand is locked, unless `unassigned`.
                    form.setValue('roleLocked', v !== 'unassigned', { shouldDirty: true });
                  }}
                  className={cn('w-44', !manage && 'pointer-events-none')}
                />
              )}
            />
          </LabelledField>
          {text('villageCode', t('npcs.fields.village'), t('npcs.config.villageHint'))}
          <LabelledField
            id="config-slot"
            label={t('npcs.fields.storekeeperSlot')}
            hint={t('npcs.config.slotHint')}
            error={message(errors.storekeeperSlot?.message)}
            className="w-40"
          >
            <Input
              id="config-slot"
              type="number"
              min={1}
              max={5}
              aria-describedby="config-slot-message"
              {...form.register('storekeeperSlot', { valueAsNumber: true })}
            />
          </LabelledField>
        </div>
        {toggle('roleLocked', t('npcs.fields.roleLocked'))}
        <LabelledField id="config-pattern" label={t('npcs.fields.schedulePattern')}>
          <Controller
            control={form.control}
            name="schedulePattern"
            render={({ field }) => (
              <OptionSelect<string>
                size="default"
                label={t('npcs.fields.schedulePattern')}
                value={field.value || NONE}
                options={[
                  { value: NONE, label: t('npcs.routine.noPattern') },
                  ...[
                    ...new Set([
                      ...(patterns.data?.items ?? []).map((p) => p.name),
                      ...(npc.schedulePattern ? [npc.schedulePattern] : []),
                    ]),
                  ].map((name) => ({ value: name, label: name })),
                ]}
                onChange={(v) => field.onChange(v === NONE ? '' : v)}
                className={cn('w-60', !manage && 'pointer-events-none')}
              />
            )}
          />
        </LabelledField>
        <Controller
          control={form.control}
          name="actionProfile"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm">{t('npcs.fields.actionProfile')}</legend>
              <div className="flex flex-wrap gap-1.5">
                {actions.map((action) => {
                  const on = field.value.includes(action);
                  return (
                    <button
                      key={action}
                      type="button"
                      aria-pressed={on}
                      disabled={!manage}
                      onClick={() =>
                        field.onChange(
                          on ? field.value.filter((a) => a !== action) : [...field.value, action],
                        )
                      }
                      className={cn(
                        'rounded-md border px-2 py-0.5 font-mono text-2xs',
                        on ? 'border-link bg-link-bg text-link' : 'text-fg-3',
                      )}
                    >
                      {action}
                    </button>
                  );
                })}
              </div>
              <span className="text-2xs text-fg-3">{t('npcs.config.profileHint')}</span>
            </fieldset>
          )}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t('npcs.config.places')}</h3>
        {PLACE_FIELDS.map(place)}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t('npcs.config.actions')}</h3>
        {json('actionTiming', t('npcs.config.timingHint'))}
        {json('actionConfig', t('npcs.config.configHint'))}
        <LabelledField
          id="config-notes"
          label={t('npcs.fields.notes')}
          error={message(errors.notes?.message)}
        >
          <Textarea
            id="config-notes"
            rows={3}
            aria-describedby="config-notes-message"
            {...form.register('notes')}
          />
        </LabelledField>
      </section>
      {refused && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/50 px-3 py-2 text-sm text-destructive"
        >
          {refused}
        </p>
      )}
      {manage && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-fg-3">
            {t('npcs.config.changes', { count: Object.keys(changes).length })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!form.formState.isDirty}
            onClick={() => {
              setRefused(null);
              form.reset(configFormValues(npc));
            }}
          >
            {t('npcs.config.reset')}
          </Button>
          <Button
            type="submit"
            disabled={
              !form.formState.isValid || Object.keys(changes).length === 0 || patch.isPending
            }
          >
            {t('npcs.config.save')}
          </Button>
        </div>
      )}
    </form>
  );
}
