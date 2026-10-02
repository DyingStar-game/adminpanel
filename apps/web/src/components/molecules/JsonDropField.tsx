import { useRef, useState, type DragEvent } from 'react';
import { FileUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';

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
  labels,
}: JsonDropFieldProps) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

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
      <Textarea
        id={id}
        aria-label={labels.field}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={labels.placeholder}
        spellCheck={false}
        className="max-h-[360px] min-h-[220px] resize-y overflow-auto border-0 font-mono text-xs shadow-none focus-visible:ring-0 [field-sizing:fixed]"
      />
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
