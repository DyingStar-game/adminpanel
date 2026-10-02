import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import { ImportPage } from './ImportPage';

const NEW = '11111111-1111-4111-8111-111111111111';
const truck = (uuid: string, data: Record<string, unknown> = {}) => ({
  object_type: 'vehicle',
  object_uuid: uuid,
  object_data: {
    parent_id: ids.planet,
    position: { x: 1, y: 2, z: 3 },
    scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
    speed: 0,
    ...data,
  },
});

const field = () => screen.getByRole('textbox', { name: 'JSON to import' });
/** Pastes text in the field (user-event would type it key by key, braces included). */
const paste = (text: string) => fireEvent.change(field(), { target: { value: text } });
const row = (n: number) => screen.getByRole('listitem', { name: `Item ${n}` });

describe('ImportPage', () => {
  it('points at the line and column of malformed JSON', async () => {
    useInProcessBff();
    renderWithProviders(<ImportPage search={{}} />);

    paste('[\n  {"object_type": "vehicle",}\n]');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/line 2, column \d+/);
    // The cursor goes to the faulty character, on the line numbered in the gutter.
    await userEvent.click(screen.getByRole('button', { name: 'Go to the error' }));
    const textarea = field() as HTMLTextAreaElement;
    expect(textarea).toHaveFocus();
    expect(textarea.value.slice(0, textarea.selectionStart).split('\n')).toHaveLength(2);
  });

  it('checks every item, then creates the new ones and skips existing ones by default', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<ImportPage search={{}} />);

    paste(
      JSON.stringify([
        truck(NEW, { speed: 'fast' }),
        truck(ids.vehicle),
        { object_type: 'spaceship', object_data: {} },
      ]),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(
      await screen.findByText('1 new · 1 already on the server · 1 invalid · 1 with warnings'),
    ).toBeInTheDocument();
    expect(within(row(1)).getByText('new')).toBeInTheDocument();
    expect(
      within(row(1)).getByText(/Existing items hold a number here, this one a string/),
    ).toBeInTheDocument();
    expect(within(row(1)).getByText('object_data.speed')).toBeInTheDocument();
    expect(within(row(2)).getByText('exists')).toBeInTheDocument();
    expect(within(row(3)).getByText(/Unknown object type "spaceship"/)).toBeInTheDocument();
    // A missing UUID is generated.
    expect(within(row(3)).getByText('generated UUID')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Import 1 item' }));
    // Nothing is sent before the confirmation, which sums up the impact.
    const dialog = await screen.findByRole('alertdialog', { name: 'Import 1 item?' });
    expect(bff.persistence.items.has(NEW)).toBe(false);
    expect(within(dialog).getByText('1 item will be created.')).toBeInTheDocument();
    expect(within(dialog).getByText('1 of them has warnings.')).toBeInTheDocument();
    expect(within(dialog).getByText(/2 items are not sent/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 1 item' }));

    expect(await screen.findByText(/1 created, 0 overwritten, 0 failed/)).toBeInTheDocument();
    expect(bff.persistence.items.get(NEW)?.object_data).toMatchObject({ speed: 'fast' });
    expect(within(row(1)).getByText('created')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download the report' })).toBeInTheDocument();
  });

  it('overwrites existing items when asked', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<ImportPage search={{}} />);

    paste(JSON.stringify([truck(ids.vehicle, { speed: 12 })]));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(
      await screen.findByRole('switch', { name: 'Overwrite the existing item' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 item' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/1 existing item will be overwritten/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 1 item' }));

    expect(await screen.findByText(/0 created, 1 overwritten, 0 failed/)).toBeInTheDocument();
    expect(within(row(1)).getByText('overwritten')).toBeInTheDocument();
    const stored = bff.persistence.items.get(ids.vehicle)?.object_data;
    expect(stored).toMatchObject({ speed: 12 });
    // Full replace: keys absent from the import are gone.
    expect(stored).not.toHaveProperty('pilot_uuid');
  });

  it('reads a dropped file and gives the default level to items without a parent', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<ImportPage search={{ parent: ids.planet }} />);

    const file = new File(
      [JSON.stringify([{ object_type: 'vehicle', object_uuid: NEW, object_data: { speed: 0 } }])],
      'trucks.json',
      { type: 'application/json' },
    );
    fireEvent.drop(field(), { dataTransfer: { files: [file] } });

    expect(await screen.findByText('Loaded from trucks.json')).toBeInTheDocument();
    expect((field() as HTMLTextAreaElement).value).toContain(NEW);
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 1 item' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Import 1 item' }),
    );

    await waitFor(() =>
      expect(bff.persistence.items.get(NEW)?.object_data.parent_id).toBe(ids.planet),
    );
  });
});
