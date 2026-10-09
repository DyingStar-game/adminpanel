import { describe, expect, it } from 'vitest';
import { bodyFactList, bodyFacts, wikiUrl } from './bodies';

describe('body facts from the wiki', () => {
  it('finds a planet, a moon and the star by their scene', () => {
    const sandbox = bodyFacts('scenes/systems/tarsis/tarsis_3.tscn');
    expect(sandbox).toMatchObject({ designation: 'Tarsis III', name: 'Sandbox', radiusKm: 6356 });
    expect(sandbox && wikiUrl(sandbox)).toMatch(/system_tarsis\/tarsis_III\/$/);
    const korax = bodyFacts('scenes/systems/tarsis/tarsis_3_1.tscn');
    expect(korax).toMatchObject({ name: 'Korax' });
    // A moon links to its section of its planet's page.
    expect(korax && wikiUrl(korax)).toMatch(/tarsis_III\/#tarsis-ivm1$/);
    expect(bodyFacts('scenes/_universe/environment/space/star.tscn')).toMatchObject({
      temperatureK: 4831,
    });
    expect(bodyFacts('scenes/systems/other/planet_9.tscn')).toBeNull();
    expect(bodyFacts(undefined)).toBeNull();
  });

  it('lists only the facts a body has, in display order', () => {
    const moon = bodyFacts('scenes/systems/tarsis/tarsis_4_1.tscn');
    expect(moon && bodyFactList(moon).map((f) => f.key)).toEqual(['radius', 'gravity', 'orbit']);
  });
});
