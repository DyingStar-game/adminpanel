import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDataset, emptyCrate, haulingCrate, ids } from '@dyingstar-admin/testing';
import { schematicFor } from '@/lib/schematics';
import { contentsOf, ownGoodsOf } from '@/lib/schematics/contents';
import { SchematicCard } from './SchematicCard';

const resolveRef = () => ({ status: 'missing' as const });

const schematicOf = (scenename: unknown) => {
  const schematic = schematicFor(scenename);
  if (!schematic) throw new Error(`no schematic for ${String(scenename)}`);
  return schematic;
};

describe('SchematicCard', () => {
  it('draws a crate with what it holds beside it, listed on a click (ADR 0029)', async () => {
    const schematic = schematicOf(haulingCrate.object_data.scenename);
    render(
      <SchematicCard
        schematic={schematic}
        data={haulingCrate.object_data}
        resolveRef={resolveRef}
        onNavigate={vi.fn()}
        contents={ownGoodsOf(schematic, haulingCrate.object_data)}
      />,
    );

    const drawing = screen.getByRole('img', { name: 'Crate' });
    const load = within(drawing).getByRole('link', { name: 'Gold · 66 L · 50 kg' });
    expect(load).toHaveTextContent('66 L');
    expect(load).toHaveTextContent('Gold');
    // A click lists what it holds under the drawing, as a group of rocks; again, hides it.
    await userEvent.click(load);
    const list = screen.getByRole('region', { name: 'Holds: Gold' });
    expect(list).toHaveTextContent('MineralGold');
    expect(list).toHaveTextContent('Quantity66 L');
    expect(list).toHaveTextContent('Volume0.066 m³');
    expect(list).toHaveTextContent('Mass50 kg');
    await userEvent.click(load);
    expect(screen.queryByRole('region', { name: 'Holds: Gold' })).not.toBeInTheDocument();
  });

  it('says an empty crate is empty', async () => {
    const schematic = schematicOf(emptyCrate.object_data.scenename);
    render(
      <SchematicCard
        schematic={schematic}
        data={emptyCrate.object_data}
        resolveRef={resolveRef}
        onNavigate={vi.fn()}
        contents={ownGoodsOf(schematic, emptyCrate.object_data)}
      />,
    );

    const load = screen.getByRole('link', { name: 'empty' });
    expect(load).toHaveTextContent('∅');
    await userEvent.click(load);
    expect(screen.getByRole('region', { name: 'Holds: empty' })).toBeInTheDocument();
  });

  it('draws the crates a truck carries as one box, listing what each holds on a click', async () => {
    const truck = createDataset().find((item) => item.object_uuid === ids.vehicle);
    if (!truck) throw new Error('no truck fixture');
    const schematic = schematicOf(truck.object_data.scenename);
    const empty = { ...emptyCrate, object_data: { ...emptyCrate.object_data, weight: 20 } };
    const onNavigate = vi.fn();
    render(
      <SchematicCard
        schematic={schematic}
        data={truck.object_data}
        resolveRef={resolveRef}
        onNavigate={onNavigate}
        contents={contentsOf(schematic, truck.object_data, [haulingCrate, empty])}
      />,
    );

    // One box, like the ore: its count, weight and name, whatever the crates hold.
    await userEvent.click(screen.getByRole('link', { name: '2 × Crate · 70 kg' }));
    const list = screen.getByRole('region', { name: 'Carried: Crate' });
    // One flat list, no section by what they hold: each line says it, then opens its crate.
    expect(within(list).queryByRole('group', { name: 'Gold' })).not.toBeInTheDocument();
    const rows = within(list).getAllByRole('button', { name: /Crate|crate_container/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      'crate_container 90b295ddGold · 66 L · 0.066 m³50 kg',
      'CrateContainer5empty20 kg',
    ]);
    await userEvent.click(rows[0] as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith(haulingCrate.object_uuid);
  });

  it('lists a single crate the truck carries too, instead of opening it', async () => {
    const truck = createDataset().find((item) => item.object_uuid === ids.vehicle);
    if (!truck) throw new Error('no truck fixture');
    const schematic = schematicOf(truck.object_data.scenename);
    const onNavigate = vi.fn();
    render(
      <SchematicCard
        schematic={schematic}
        data={truck.object_data}
        resolveRef={resolveRef}
        onNavigate={onNavigate}
        contents={contentsOf(schematic, truck.object_data, [haulingCrate])}
      />,
    );

    await userEvent.click(screen.getByRole('link', { name: '1 × Crate · 50 kg' }));
    expect(onNavigate).not.toHaveBeenCalled();
    const list = screen.getByRole('region', { name: 'Carried: Crate' });
    expect(within(list).getByRole('button', { name: /66 L/ })).toBeInTheDocument();
  });
});
