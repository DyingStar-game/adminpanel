import { useEffect, useRef, useState, type DragEvent } from 'react';
import { FileUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';

/** Line height of the field and its gutter (`leading-5`). */
const LINE_PX = 20;

interface JsonDropFieldProps {
  id: string;
  value: string;
  onChange: (text: string) => void;
  /** A file was dropped or picked: its text replaces the field (and its name is shown). */
  onFile: (text: string, name: string) => void;
  /** A file is larger than `maxBytes`: it is not read. */
  onTooLarge: (name: string) => void;
  maxBytes: number;
  invalid?: boolean;
  /** Line (1-based) highlighted in the gutter: where the JSON is malformed. */
  errorLine?: number | undefined;
  /** Line ranges (1-based, inclusive) highlighted in the gutter, e.g. probable duplicates. */
  highlights?: { fromLine: number; toLine: number }[];
  /** Puts the cursor at this offset and scrolls to it; a new `nonce` asks again. */
  focusAt?: { offset: number; nonce: number } | null;
  labels: { field: string; drop: string; pick: string; placeholder: string };
}

/**
 * JSON input of the bulk import (ADR 0019): text pasted in the field, or a `.json` file dropped
 * on it or picked; the file's content fills the field so it can be read and fixed.
 */
export function JsonDropField({
  id,
  value,
  onChange,
  onFile,
  onTooLarge,
  maxBytes,
  invalid = false,
  errorLine,
  highlights = [],
  focusAt,
  labels,
}: JsonDropFieldProps) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;

  useEffect(() => {
    const textarea = area.current;
    if (!focusAt || !textarea) return;
    textarea.focus();
    textarea.setSelectionRange(focusAt.offset, focusAt.offset + 1);
    const line = value.slice(0, focusAt.offset).split('\n').length;
    textarea.scrollTop = Math.max(0, (line - 1) * LINE_PX - textarea.clientHeight / 2);
    // Only a new request moves the cursor, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAt]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxBytes) return onTooLarge(file.name);
    onFile(await file.text(), file.name);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void read(event.dataTransfer.files[0]);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={cn(
        'relative flex flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors',
        dragging ? 'border-link bg-link-bg' : 'border-line-strong',
      )}
    >
      <div className="flex h-[320px] min-h-[160px] resize-y overflow-hidden rounded-md bg-background">
        {/* Line numbers, scrolled with the text (lines do not wrap). */}
        <div
          ref={gutter}
          aria-hidden
          className="shrink-0 overflow-hidden border-r bg-surface-2 py-2 pr-2 pl-3 text-right font-mono text-xs leading-5 text-fg-3 select-none"
        >
          {Array.from({ length: lines }, (_, i) => (
            <div
              key={i}
              className={cn(
                highlights.some((h) => i + 1 >= h.fromLine && i + 1 <= h.toLine) &&
                  'bg-amber-500/20 text-amber-700 dark:text-amber-400',
                i + 1 === errorLine &&
                  'rounded-sm bg-destructive/15 font-semibold text-destructive',
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <Textarea
          ref={area}
          id={id}
          aria-label={labels.field}
          aria-invalid={invalid}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
          }}
          placeholder={labels.placeholder}
          spellCheck={false}
          wrap="off"
          className="h-full min-h-0 flex-1 resize-none overflow-auto rounded-none border-0 font-mono text-xs leading-5 whitespace-pre shadow-none field-sizing-fixed focus-visible:ring-0 md:text-xs"
        />
      </div>
      <div className="flex items-center gap-2 px-1 text-xs text-fg-3">
        <FileUpIcon className="size-4 shrink-0" />
        <span className="flex-1">{labels.drop}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          {labels.pick}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            void read(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {dragging && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-link-bg/80 text-sm font-medium text-link">
          {labels.drop}
        </div>
      )}
    </div>
  );
}
