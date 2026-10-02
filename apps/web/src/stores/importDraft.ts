import { create } from 'zustand';
import type { ImportRow } from '@dyingstar-admin/schemas';
import type { ParsedImport } from '@/lib/importInput';

export type ImportOutcome =
  { state: 'created' | 'overwritten' } | { state: 'failed'; message: string };

export interface ImportRunState {
  running: boolean;
  done: number;
  total: number;
  /** Outcome per input row index. */
  outcomes: Map<number, ImportOutcome>;
  cancelled: boolean;
}

export interface CheckedImport {
  /** Items as checked (aliases resolved once the server answered): what is sent. */
  items: unknown[];
  generated: Set<number>;
  rows: ImportRow[];
  /** The server's statuses and warnings are in (format only before). */
  fromServer: boolean;
}

export type ImportInputError = Exclude<ParsedImport, { ok: true }>;

interface ImportDraftState {
  text: string;
  fileName: string | null;
  defaultParent: string;
  useDefaultParent: boolean;
  inputError: ImportInputError | null;
  checked: CheckedImport | null;
  checking: boolean;
  overwrite: Set<number>;
  run: ImportRunState;
  /** Bumped on every edit: a check answering after the text changed is dropped. */
  generation: number;
  /** Asked by the user, read by the send loop between items. */
  cancelRequested: boolean;

  /** Replaces the text: the previous check and run no longer apply. */
  edit: (text: string, fileName?: string | null) => void;
  setDefaultParent: (value: string) => void;
  setUseDefaultParent: (value: boolean) => void;
  setInputError: (error: ImportInputError | null) => void;
  setChecked: (checked: CheckedImport | null) => void;
  setChecking: (checking: boolean) => void;
  setOverwrite: (update: (current: Set<number>) => Set<number>) => void;
  setRun: (update: (current: ImportRunState) => ImportRunState) => void;
  requestCancel: (value: boolean) => void;
  /** Empties the import: text, file, findings, choices and the last run. */
  clear: () => void;
}

export const IDLE_RUN: ImportRunState = {
  running: false,
  done: 0,
  total: 0,
  outcomes: new Map(),
  cancelled: false,
};

/**
 * Draft of the bulk import, kept in memory while the user moves between pages (ADR 0019): only
 * Clear empties it. Not persisted in the browser: an import can weigh 5 MB, more than local
 * storage holds, so a reload starts over. A send keeps running while on another page.
 */
export const useImportDraft = create<ImportDraftState>()((set) => ({
  text: '',
  fileName: null,
  defaultParent: '',
  useDefaultParent: false,
  inputError: null,
  checked: null,
  checking: false,
  overwrite: new Set(),
  run: IDLE_RUN,
  generation: 0,
  cancelRequested: false,

  edit: (text, fileName = null) =>
    set((s) => ({
      text,
      fileName,
      generation: s.generation + 1,
      checked: null,
      checking: false,
      inputError: null,
      overwrite: new Set(),
      run: s.run.running ? s.run : IDLE_RUN,
    })),
  setDefaultParent: (defaultParent) => set({ defaultParent, checked: null }),
  setUseDefaultParent: (useDefaultParent) => set({ useDefaultParent, checked: null }),
  setInputError: (inputError) => set({ inputError }),
  setChecked: (checked) => set({ checked }),
  setChecking: (checking) => set({ checking }),
  setOverwrite: (update) => set((s) => ({ overwrite: update(s.overwrite) })),
  setRun: (update) => set((s) => ({ run: update(s.run) })),
  requestCancel: (cancelRequested) => set({ cancelRequested }),
  clear: () =>
    set((s) =>
      s.run.running
        ? {}
        : {
            text: '',
            fileName: null,
            generation: s.generation + 1,
            inputError: null,
            checked: null,
            checking: false,
            overwrite: new Set(),
            run: IDLE_RUN,
          },
    ),
}));
