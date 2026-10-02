import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
} from 'react-hook-form';
import type { ObjectDefinition } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { PropertyInput } from '@/components/molecules/PropertyInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseRaw, toRaw, type PropertyKind } from '@/lib/propertyForm';
import { PROPERTY_KINDS, type PropertiesFormValues } from '@/lib/propertyFormSchema';

interface PropertiesEditorProps {
  control: Control<PropertiesFormValues>;
  errors: FieldErrors<PropertiesFormValues>;
  /** `null`: type without definition; `undefined`: definitions not loaded yet. */
  definition: ObjectDefinition | null | undefined;
  /** Keys the game changed since editing started (ADR 0009). */
  gameChanged?: ReadonlySet<string>;
}

/**
 * Editable list of `object_data` properties. Definition properties are suggested, keys the
 * definition does not declare are flagged as not replicated (ADR 0006).
 */
export function PropertiesEditor({
  control,
  errors,
  definition,
  gameChanged,
}: PropertiesEditorProps) {
  const { t } = useTranslation();
  const { fields, append, remove, update } = useFieldArray({ control, name: 'properties' });
  // Current values: `fields` only reflects the rows as they were appended.
  const rows = useWatch({ control, name: 'properties' });
  const [newKey, setNewKey] = useState('');
  const declared = new Set(definition?.channels.flatMap((c) => c.properties) ?? []);
  const present = new Set(rows.map((row) => row.key));
  const suggestions = [...declared].filter((key) => !present.has(key)).sort();

  const add = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed || present.has(trimmed)) return;
    const vector = trimmed === 'position' || trimmed === 'rotation';
    append({ key: trimmed, kind: vector ? 'vec3' : 'text', raw: vector ? '0,0,0' : '' });
    setNewKey('');
  };

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => {
        const rowErrors = errors.properties?.[index];
        const message = rowErrors?.raw?.message ?? rowErrors?.key?.message;
        return (
          <div key={field.id} className="flex flex-col gap-1 rounded-md border px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <MonoText className="min-w-0 flex-1 truncate text-[11.5px]" title={field.key}>
                {field.key}
              </MonoText>
              {definition && !declared.has(field.key) && (
                <Badge variant="outline" className="text-[10px]">
                  {t('inspector.notReplicated')}
                </Badge>
              )}
              {gameChanged?.has(field.key) && (
                <Badge className="bg-flash text-[10px] text-foreground">
                  {t('editor.changedInGame')}
                </Badge>
              )}
              <Controller
                control={control}
                name={`properties.${index}.kind`}
                render={({ field: kindField }) => (
                  <OptionSelect<PropertyKind>
                    label={t('editor.kind', { key: field.key })}
                    value={kindField.value}
                    options={PROPERTY_KINDS.map((k) => ({
                      value: k,
                      label: t(`editor.kinds.${k}`),
                    }))}
                    onChange={(kind) => {
                      // Keep the value when it converts, else start from the new kind's default.
                      const current = rows[index];
                      const parsed = current ? parseRaw(current.raw, current.kind) : null;
                      update(index, {
                        key: field.key,
                        kind,
                        raw: toRaw(parsed?.ok ? parsed.value : undefined, kind),
                      });
                    }}
                    className="h-6 w-24"
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t('editor.remove', { key: field.key })}
                onClick={() => remove(index)}
              >
                <Trash2Icon />
              </Button>
            </div>
            <Controller
              control={control}
              name={`properties.${index}.raw`}
              render={({ field: rawField }) => (
                <PropertyInput
                  id={`property-${field.id}`}
                  label={field.key}
                  kind={rows[index]?.kind ?? field.kind}
                  value={rawField.value}
                  onChange={rawField.onChange}
                  invalid={!!message}
                />
              )}
            />
            {message && (
              <span role="alert" className="text-[11px] text-destructive">
                {t(`editor.errors.${message}` as 'editor.errors.json')}
              </span>
            )}
          </div>
        );
      })}

      <div className="flex gap-1.5">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(newKey);
            }
          }}
          placeholder={t('editor.newKey')}
          aria-label={t('editor.newKey')}
          className="h-7 font-mono text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => add(newKey)}>
          <PlusIcon />
          {t('editor.add')}
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-fg-3">{t('editor.suggestions')}</span>
          {suggestions.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="xs"
              className="font-mono"
              onClick={() => add(key)}
            >
              + {key}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
