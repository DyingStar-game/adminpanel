import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { ProfileValue } from '@/components/molecules/ProfileValue';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { cn } from '@/lib/cn';
import { profileFor } from '@/lib/profiles';
import { kWh, levelColor, type InstalledEnergy } from '@/lib/schematics/components';

interface HeadlineFactsProps {
  item: Item;
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
  changed?: ReadonlySet<string>;
  /** Keys the model's schematic already shows: facts made only of them are left out. */
  hidden?: ReadonlySet<string>;
  /** Tiles added after the item's own facts (a body's facts from the wiki). */
  extra?: { key: string; label: string; value: string }[];
  /** Energy of the installed batteries, when the model reports it (a truck). */
  energy?: InstalledEnergy | null;
}

/** Key facts of a profiled type (e.g. speed, engine, limiter for a vehicle). */
export function HeadlineFacts({
  item,
  resolveRef,
  onNavigate,
  changed,
  hidden,
  extra = [],
  energy,
}: HeadlineFactsProps) {
  const { t, i18n } = useTranslation();
  const profile = profileFor(item.object_type);
  const data = item.object_data;
  const facts = (profile?.headline ?? []).filter(
    (keys) => keys.some((key) => key in data) && !keys.every((key) => hidden?.has(key)),
  );
  if (facts.length === 0 && !energy && extra.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
      {facts.map((keys) => (
        <div
          key={keys.join('+')}
          className={cn(
            'flex flex-col gap-1 rounded-xl border bg-surface-2 px-4 py-3 transition-colors duration-700',
            keys.some((key) => changed?.has(key)) && 'bg-flash',
          )}
        >
          <span className="text-3xs font-semibold tracking-[0.15em] text-fg-3 uppercase">
            {keys.join(' / ')}
          </span>
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
      {extra.map((fact) => (
        <div
          key={fact.key}
          className="flex flex-col gap-1 rounded-xl border bg-surface-2 px-4 py-3"
        >
          <span className="text-3xs font-semibold tracking-[0.15em] text-fg-3 uppercase">
            {fact.label}
          </span>
          <MonoText className="text-sm">{fact.value}</MonoText>
        </div>
      ))}
      {energy && <EnergyFact energy={energy} language={i18n.language} />}
    </div>
  );
}

/** Energy left in the installed batteries, in kWh like in game, over a charge bar. */
function EnergyFact({ energy, language }: { energy: InstalledEnergy; language: string }) {
  const { t } = useTranslation();
  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  const level = energy.capacityJ > 0 ? Math.min(1, energy.chargeJ / energy.capacityJ) : 0;
  const percent = Math.round(level * 100);
  const left = `${format.format(kWh(energy.chargeJ))} kWh`;
  return (
    <div
      className="flex flex-col gap-1 rounded-xl border bg-surface-2 px-4 py-3"
      title={
        energy.batteries > 0
          ? `${left} / ${format.format(kWh(energy.capacityJ))} kWh · ${percent} %`
          : undefined
      }
    >
      <span className="text-3xs font-semibold tracking-[0.15em] text-fg-3 uppercase">
        {t('schematic.labels.energy')}
      </span>
      {energy.batteries === 0 ? (
        <MonoText tone="subtle" className="text-sm">
          {t('schematic.noBattery')}
        </MonoText>
      ) : (
        <>
          {/* Same value line as the other facts; the capacity follows, smaller and dimmed. */}
          <div className="flex items-baseline gap-1 text-sm whitespace-nowrap">
            <MonoText>{format.format(kWh(energy.chargeJ))}</MonoText>
            <MonoText tone="subtle" className="text-xs">
              / {format.format(kWh(energy.capacityJ))} kWh
            </MonoText>
          </div>
          <div
            role="progressbar"
            aria-label={t('schematic.labels.energy')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={left}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg-3/25"
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${percent}%`, background: levelColor(level) }}
            />
          </div>
        </>
      )}
    </div>
  );
}
