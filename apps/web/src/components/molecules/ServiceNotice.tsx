/** Why a service's view is empty: unreachable, or the account may not see it. */
export function ServiceNotice({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-amber-500/40 px-4 py-3 text-sm text-fg-2">
      {message}
    </p>
  );
}
