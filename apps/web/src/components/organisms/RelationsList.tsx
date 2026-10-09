import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { PropertyRow } from '@/components/molecules/PropertyRow';
import { UuidLink, type RefTarget } from '@/components/molecules/UuidLink';
import { Badge } from '@/components/ui/badge';
import type { ItemRef } from '@/hooks/useItemRefs';

interface RelationsListProps {
  parentId: string | undefined;
  parentTarget: RefTarget | null;
  refs: ItemRef[];
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
}

/** Parent and outgoing references; dangling links and unexpected target types are flagged. */
export function RelationsList({
  parentId,
  parentTarget,
  refs,
  resolveRef,
  onNavigate,
}: RelationsListProps) {
  const { t } = useTranslation();
  const missing = t('value.brokenLink');

  return (
    <>
      <PropertyRow name="parent_id" wide>
        {parentId && parentTarget ? (
          <UuidLink
            uuid={parentId}
            target={parentTarget}
            onNavigate={onNavigate}
            missingLabel={missing}
          />
        ) : (
          <MonoText tone="subtle">{t('inspector.root')}</MonoText>
        )}
      </PropertyRow>
      {refs.map((ref) => {
        const target = resolveRef(ref.uuid);
        const unexpected =
          target.status === 'found' &&
          ref.expectedType !== null &&
          target.objectType !== ref.expectedType;
        return (
          <PropertyRow key={ref.path} name={ref.path} wide>
            <span className="flex min-w-0 items-center gap-1.5">
              <UuidLink
                uuid={ref.uuid}
                target={target}
                onNavigate={onNavigate}
                missingLabel={missing}
              />
              {ref.label && (
                <MonoText tone="subtle" className="shrink-0 text-3xs">
                  {ref.label}
                </MonoText>
              )}
              {unexpected && (
                <Badge variant="outline" className="text-3xs" title={ref.expectedType ?? ''}>
                  {t('relations.unexpectedType', { type: ref.expectedType })}
                </Badge>
              )}
            </span>
          </PropertyRow>
        );
      })}
    </>
  );
}
