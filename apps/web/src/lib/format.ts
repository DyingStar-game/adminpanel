/** Replication distance from a definition: metres, or kilometres from 1 000 m. */
export function formatDistance(metres: number, locale: string): string {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return metres >= 1000 ? `${format.format(metres / 1000)} km` : `${format.format(metres)} m`;
}
