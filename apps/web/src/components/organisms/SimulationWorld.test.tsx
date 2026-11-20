import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationWorld } from './SimulationWorld';

const world = {
  economyScale: 25,
  federation: { code: 'ARES', name: 'ARES', planetInternalName: 'tarsis_3' },
};
const jsonFile = (name: string, text: string) =>
  new File([text], name, { type: 'application/json' });

describe('SimulationWorld (ADR 0025 › The world)', () => {
  it('lists the routes between villages by name, and deletes one once confirmed', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<SimulationWorld />);

    const table = await screen.findByRole('table', { name: 'Routes between villages' });
    const rows = await within(table).findAllByRole('row', { name: /km/ });
    expect(rows).toHaveLength(4);
    const [first] = rows;
    if (!first) throw new Error('no route listed');
    expect(first).toHaveTextContent('F0001');
    expect(first).toHaveTextContent('25 km');

    await userEvent.click(
      within(first).getByRole('button', { name: /Delete the route from F0001/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete the route' }));
    await vi.waitFor(() =>
      expect(bff.universesimulator.writes.map((w) => w.call)).toEqual([
        expect.stringMatching(/^DELETE \/travel-routes\//),
      ]),
    );
  });

  it('lists the mineral sources by village, and opens one to change it', async () => {
    useInProcessBff();
    renderWithProviders(<SimulationWorld />);

    const table = await screen.findByRole('table', { name: 'Mineral sources' });
    const [first] = await within(table).findAllByRole('row', { name: /M0002/ });
    if (!first) throw new Error('no mineral source listed');
    expect(first).toHaveTextContent('500');
    expect(first).toHaveTextContent('No end');

    await userEvent.click(within(first).getByRole('button', { name: /Change the source of/ }));
    expect(await screen.findByLabelText('Most asked by one mining order')).toHaveValue(500);
  });

  it('imports a world file once confirmed, and shows what the service made of it', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<SimulationWorld />);
    const picker = await screen.findByLabelText('World file (.json)');

    await userEvent.upload(picker, jsonFile('notes.json', '{"villages": {}}'));
    expect(await screen.findByRole('alert')).toHaveTextContent('not a world file');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();

    await userEvent.upload(picker, jsonFile('tarsis_3-ares.json', JSON.stringify(world)));
    expect(await screen.findByText(/tarsis_3-ares.json: federation ARES/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(bff.universesimulator.writes).toHaveLength(0);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Import' }),
    );

    expect(await screen.findByText('Villages')).toBeInTheDocument();
    expect(bff.universesimulator.writes).toEqual([{ call: 'POST /import', body: world }]);
  });
});
