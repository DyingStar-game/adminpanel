import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { ProfileValue } from '@/components/molecules/ProfileValue';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { profileFor } from '@/lib/profiles';

interface HeadlineFactsProps {
  item: Item;
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
}

/** Key facts of a profiled type (e.g. speed, engine, limiter for a vehicle). */
export function HeadlineFacts({ item, resolveRef, onNavigate }: HeadlineFactsProps) {
  const { t } = useTranslation();
  const profile = profileFor(item.object_type);
  const data = item.object_data;
  const facts = (profile?.headline ?? []).filter((keys) => keys.some((key) => key in data));
  if (facts.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
      {facts.map((keys) => (
        <div
          key={keys.join('+')}
          className="flex flex-col gap-1 rounded-lg border bg-background px-3 py-2.5"
        >
          <MonoText tone="subtle" className="text-[11px]">
            {keys.join(' / ')}
          </MonoText>
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            {keys.map((key) =>
              // Orbital samples are listed in the properties; the headline only counts them.
              profile?.renderers[key] === 'orbitalSamples' && Array.isArray(data[key]) ? (
                <MonoText key={key}>{t('profile.samples', { count: data[key].length })}</MonoText>
              ) : (
                <ProfileValue
                  key={key}
                  value={data[key]}
                  name={key}
                  data={data}
                  renderer={profile?.renderers[key]}
                  resolveRef={resolveRef}
                  onNavigate={onNavigate}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
