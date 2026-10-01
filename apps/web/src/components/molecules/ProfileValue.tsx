import { useTranslation } from 'react-i18next';
import { QuaternionSchema, Vec3Schema, type ObjectData } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import type { Renderer } from '@/lib/profiles';
import { ValueView, type ValueViewProps } from './ValueView';

interface ProfileValueProps extends ValueViewProps {
  renderer: Renderer | undefined;
  /** Whole `object_data`, for renderers pairing keys (positions + rotations). */
  data: ObjectData;
}

const fixed = (n: number) => Number(n.toFixed(3)).toString();

/** Property value with the type profile's renderer, generic `ValueView` otherwise (ADR 0008). */
export function ProfileValue({ renderer, data, ...props }: ProfileValueProps) {
  const { t } = useTranslation();
  const { value } = props;

  if (renderer === 'namedMap' && value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <MonoText tone="subtle">{'{}'}</MonoText>;
    return (
      <div className="flex flex-col gap-0.5 py-1">
        {entries.map(([key, child]) => (
          <div
            key={key}
            className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-2"
          >
            <MonoText tone="subtle">{key}</MonoText>
            <ValueView {...props} value={child} name={key} />
          </div>
        ))}
      </div>
    );
  }

  if (renderer === 'inlineList' && Array.isArray(value)) {
    return <MonoText>[{value.map((v) => String(v)).join(', ')}]</MonoText>;
  }

  if (renderer === 'angle' && typeof value === 'number') {
    return (
      <MonoText>
        {fixed(value)} rad · {fixed((value * 180) / Math.PI)}°
      </MonoText>
    );
  }

  if (renderer === 'orbitalSamples' && Array.isArray(value)) {
    const rotations = Array.isArray(data.rotations) ? data.rotations : [];
    return (
      <div className="flex flex-col gap-0.5 py-1">
        <MonoText tone="subtle">{t('profile.samples', { count: value.length })}</MonoText>
        {value.map((sample, i) => {
          const position = Vec3Schema.safeParse(sample);
          const rotation = QuaternionSchema.safeParse(rotations[i]);
          return (
            <div key={i} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2">
              <MonoText tone="subtle">{i}</MonoText>
              <MonoText className="truncate" title="position x, y, z">
                {position.success
                  ? `${fixed(position.data.x)}, ${fixed(position.data.y)}, ${fixed(position.data.z)}`
                  : JSON.stringify(sample)}
              </MonoText>
              {rotation.success && (
                <MonoText tone="muted" className="col-start-2 truncate" title="rotation w, x, y, z">
                  ↻ {fixed(rotation.data.w)}, {fixed(rotation.data.x)}, {fixed(rotation.data.y)},{' '}
                  {fixed(rotation.data.z)}
                </MonoText>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return <ValueView {...props} />;
}
