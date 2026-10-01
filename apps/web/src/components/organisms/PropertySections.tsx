import { useTranslation } from 'react-i18next';
import type { Item, ObjectDefinition } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { ProfileValue } from '@/components/molecules/ProfileValue';
import { PropertyRow } from '@/components/molecules/PropertyRow';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { groupByChannel } from '@/lib/channels';
import { formatDistance } from '@/lib/format';
import { profileFor } from '@/lib/profiles';

interface PropertySectionsProps {
  item: Item;
  definition: ObjectDefinition | null | undefined;
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
}

/** Properties grouped by replication channel, undeclared keys last (ADR 0006, 0008). */
export function PropertySections({
  item,
  definition,
  resolveRef,
  onNavigate,
}: PropertySectionsProps) {
  const { t, i18n } = useTranslation();
  const profile = profileFor(item.object_type);
  const hidden = new Set(profile?.hidden ?? []);
  const data = item.object_data;

  return groupByChannel(data, definition).map((section) => {
    const keys = section.keys.filter((key) => !hidden.has(key));
    if (keys.length === 0) return null;
    return (
      <div key={section.zone ?? 'undeclared'}>
        <SectionTitle
          title={
            section.zone === null
              ? t('inspector.undeclared')
              : t('inspector.zone', { zone: section.zone })
          }
          meta={
            section.zone === null
              ? t('inspector.notReplicated')
              : `${formatDistance(section.distance ?? 0, i18n.language)} · ${section.frequency} Hz`
          }
        />
        {keys.map((key) => (
          <PropertyRow key={key} name={key}>
            <ProfileValue
              value={data[key]}
              name={key}
              data={data}
              renderer={profile?.renderers[key]}
              resolveRef={resolveRef}
              onNavigate={onNavigate}
            />
          </PropertyRow>
        ))}
      </div>
    );
  });
}

export function SectionTitle({ title, meta }: { title: string; meta?: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between px-4.5 pt-4.5 pb-1.5">
      <span className="text-[11px] font-medium tracking-[.06em] text-fg-3 uppercase">{title}</span>
      {meta && (
        <MonoText tone="subtle" className="text-[11px]">
          {meta}
        </MonoText>
      )}
    </div>
  );
}
