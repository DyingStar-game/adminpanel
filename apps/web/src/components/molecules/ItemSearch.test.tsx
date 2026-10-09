import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemSearch, type ItemSearchResult } from './ItemSearch';

const labels = {
  field: 'Search',
  empty: 'No match',
  loading: 'Searching…',
  more: (shown: number, total: number) => `${shown} of ${total}`,
};

function Harness(props: {
  results: ItemSearchResult[];
  loading?: boolean;
  total?: number;
  onPick?: (uuid: string) => void;
  onSubmit?: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <ItemSearch
      query={query}
      onQueryChange={setQuery}
      results={query ? props.results : []}
      loading={props.loading}
      total={props.total}
      onPick={props.onPick ?? vi.fn()}
      onSubmit={props.onSubmit}
      labels={labels}
    />
  );
}

describe('ItemSearch', () => {
  it('lists the results with their hint, says when more exist, and hands a pick over', async () => {
    const onPick = vi.fn();
    render(
      <Harness
        results={[{ uuid: 'p', label: 'ddurieux', objectType: 'player', hint: 'tarsis_4-1006' }]}
        total={12}
        onPick={onPick}
      />,
    );
    await userEvent.type(screen.getByRole('combobox', { name: 'Search' }), 'dur');

    expect(screen.getByText('tarsis_4-1006')).toBeInTheDocument();
    expect(screen.getByText('1 of 12')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /ddurieux/ }));
    expect(onPick).toHaveBeenCalledWith('p');
    // The field is cleared once an item is picked.
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveValue('');
  });

  it('says it is searching, then that nothing matches', async () => {
    const { rerender } = render(<Harness results={[]} loading />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Search' }), 'zzz');
    expect(screen.getByText('Searching…')).toBeInTheDocument();

    rerender(<Harness results={[]} />);
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('submits the query on Enter when there is no result to pick', async () => {
    const onSubmit = vi.fn();
    render(<Harness results={[]} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Search' }), 'abc{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('abc');
  });
});
