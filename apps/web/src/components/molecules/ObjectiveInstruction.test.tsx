import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ObjectiveInstruction } from './ObjectiveInstruction';

describe('ObjectiveInstruction (ADR 0026)', () => {
  it('highlights the goods and the places in the sentence', () => {
    renderWithProviders(
      <ObjectiveInstruction
        parts={{
          key: 'missions.objectiveKinds.transport.instruction',
          pooledKey: null,
          values: {
            amount: '1',
            good: 'drill_parts',
            from: 'Mining depot of M0066',
            to: 'Drill site near M0066',
            player: '',
          },
        }}
      />,
    );

    expect(document.querySelector('p')).toHaveTextContent(
      'Pick up 1 × drill_parts at Mining depot of M0066, then deliver them to Drill site near M0066.',
    );
    const marks = document.querySelectorAll('mark');
    expect([...marks].map((m) => m.textContent)).toEqual([
      '1 × drill_parts',
      'Mining depot of M0066',
      'Drill site near M0066',
    ]);
  });
});
