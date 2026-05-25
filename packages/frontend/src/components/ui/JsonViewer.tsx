/** Read-only JSON preview with simple syntax highlighting per line. */
export function JsonViewer({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  return (
    <pre className="font-mono text-xs p-3 rounded-lg bg-ds-surface-elevated border border-ds-border overflow-auto max-h-64">
      <code>
        {json.split('\n').map((line, i) => (
          <span key={i} className="block">
            {colorizeLine(line)}
          </span>
        ))}
      </code>
    </pre>
  );
}

/** Applies key/value colors to a single line of stringified JSON. */
function colorizeLine(line: string): React.ReactNode {
  if (line.includes('":')) {
    const [key, ...rest] = line.split('":');
    return (
      <>
        <span className="text-ds-text">{key}"</span>
        <span className="text-gray-400">:</span>
        <span className="text-ds-success">{rest.join('":')}</span>
      </>
    );
  }
  return <span className="text-gray-300">{line}</span>;
}
