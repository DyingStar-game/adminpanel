/** Replication distance from a definition: metres, or kilometres from 1 000 m. */
export function formatDistance(metres: number, locale: string): string {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return metres >= 1000 ? `${format.format(metres / 1000)} km` : `${format.format(metres)} m`;
}

/** Date and time of a `social` record, in the viewer's language. */
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** A player id shortened for tables (the full id stays in the title and the link). */
export const shortId = (id: string) => id.slice(0, 8);
