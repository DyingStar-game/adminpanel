import type { ReactElement } from 'react';
import { Trans } from 'react-i18next';
import type { InstructionParts } from '@/lib/objectiveSchematics/instruction';
import { GOODS_COLOR, ROLE_COLORS } from '@/lib/places';

/** A highlighted piece of the sentence, tinted with `color` (a place's role, the goods). */
const mark = (color: string): ReactElement => (
  <mark
    className="rounded px-1 py-0.5 font-semibold text-foreground"
    style={{ background: `color-mix(in srgb, ${color} 22%, transparent)` }}
  />
);

/**
 * What the player has to do (ADR 0026), its key words highlighted: the goods and their quantity
 * in violet, the places in their role's colour (as their bubbles and markers: picking up in
 * blue, delivering in gold, reaching in green), the passenger in grey.
 */
export function ObjectiveInstruction({ parts }: { parts: InstructionParts }) {
  const components = {
    goods: mark(GOODS_COLOR),
    from: mark(ROLE_COLORS.pickup),
    to: mark(ROLE_COLORS.dropoff),
    reach: mark(ROLE_COLORS.target),
    player: mark('var(--ds-fg-3)'),
  };
  return (
    <p className="text-sm leading-relaxed">
      <Trans i18nKey={parts.key as never} values={parts.values} components={components} />
      {parts.pooledKey && (
        <>
          {' '}
          <Trans i18nKey={parts.pooledKey as never} values={parts.values} components={components} />
        </>
      )}
    </p>
  );
}
