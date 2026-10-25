import { describe, expect, it } from 'vitest';
import { zNpc } from '@dyingstar-admin/contracts/npc';
import { createNpcDataset, npcIds as ids } from '@dyingstar-admin/testing';
import {
  addDay,
  addRequests,
  ADD_FORM_DEFAULTS,
  AddFormSchema,
  configFormValues,
  configPatch,
  ConfigFormSchema,
  currentCell,
  liveState,
  paintCell,
  parseJsonObject,
  PatternFormSchema,
  removeDay,
  removeRequest,
  TASK_FORM_DEFAULTS,
  TaskFormSchema,
  taskToCreate,
} from './npcs';

const data = createNpcDataset();
const npc = (id: string) => zNpc.parse(data.npcs.find((n) => n.id === id));

describe('NPC helpers (ADR 0026)', () => {
  it('tells the live state', () => {
    expect(liveState({ running: true, connected: true })).toBe('connected');
    expect(liveState({ running: true, connected: false })).toBe('running');
    expect(liveState({ running: false, connected: false })).toBe('stopped');
  });

  it('paints, adds and removes days of a grid', () => {
    expect(paintCell(['....', 'TTTT'], 1, 2, 'r')).toEqual(['....', 'TTrT']);
    expect(paintCell(['..'], 0, 5, 'T')).toEqual(['..']);
    expect(addDay(['Tr..'], 4)).toEqual(['Tr..', 'Tr..']);
    expect(addDay([], 3)).toEqual(['...']);
    expect(
      addDay(
        Array.from({ length: 14 }, () => 'T'),
        1,
      ),
    ).toHaveLength(14);
    expect(removeDay(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(removeDay(['a'], 0)).toEqual(['a']);
  });

  it('wraps the rota day over the pattern', () => {
    expect(currentCell({ day: 7, hour: 6, days: ['', '', '', '', ''] })).toEqual({
      day: 2,
      hour: 6,
    });
    expect(currentCell({ day: 7, hour: 6, days: null })).toBeNull();
  });

  it('checks a pattern grid as the service does', () => {
    const ok = PatternFormSchema.safeParse({
      name: 'night',
      description: '',
      days: ['TT..', 'r...'],
    });
    expect(ok.success).toBe(true);
    const uneven = PatternFormSchema.safeParse({
      name: 'night',
      description: '',
      days: ['TT', 'T'],
    });
    expect(uneven.error?.issues.map((i) => i.message)).toEqual(['unevenDays']);
    const name = PatternFormSchema.safeParse({ name: 'Night', description: '', days: ['T'] });
    expect(name.error?.issues.map((i) => i.message)).toEqual(['patternName']);
  });

  it('reads a JSON object typed in a field', () => {
    expect(parseJsonObject('')).toBeNull();
    expect(parseJsonObject('{"a": 1}')).toEqual({ a: 1 });
    expect(parseJsonObject('[1]')).toBe('invalid');
    expect(parseJsonObject('{')).toBe('invalid');
  });

  it('builds the add and remove requests', () => {
    expect(AddFormSchema.safeParse(ADD_FORM_DEFAULTS).success).toBe(false);
    expect(addRequests({ ...ADD_FORM_DEFAULTS, create: 3 })).toEqual({
      create: { count: 3, role: 'unassigned', enabled: true },
    });
    expect(addRequests({ ...ADD_FORM_DEFAULTS, spawn: 2 })).toEqual({
      spawn: { action: 'spawn', count: 2 },
    });
    expect(
      removeRequest({ action: 'delete', scope: 'selected', count: Number.NaN, village: '' }, ['a']),
    ).toEqual({ action: 'delete', ids: ['a'] });
    expect(
      removeRequest({ action: 'despawn', scope: 'count', count: 4, village: ' M0012 ' }, []),
    ).toEqual({ action: 'despawn', count: 4, village: 'M0012' });
  });

  it('builds a task from the fields of its kind, empty ones keeping the defaults', () => {
    const wait = { ...TASK_FORM_DEFAULTS, kind: 'wait' as const };
    expect(TaskFormSchema.safeParse(wait).error?.issues[0]?.path).toEqual(['seconds']);
    expect(taskToCreate({ ...wait, seconds: 30 })).toEqual({
      kind: 'wait',
      params: { seconds: 30 },
      forceOnline: false,
    });
    expect(taskToCreate({ ...TASK_FORM_DEFAULTS, x: 1, y: 2, z: 3, timeoutS: 60 })).toEqual({
      kind: 'go_to_position',
      params: { position: { x: 1, y: 2, z: 3 }, timeout_s: 60 },
      forceOnline: false,
    });
    expect(
      taskToCreate({
        ...TASK_FORM_DEFAULTS,
        kind: 'run_action',
        action: 'take_a_walk',
        config: '',
      }),
    ).toEqual({ kind: 'run_action', params: { action: 'take_a_walk' }, forceOnline: false });
  });

  it('sends nothing for an unchanged configuration, and only what changed', () => {
    const alain = npc(ids.alain);
    const form = configFormValues(alain);
    expect(ConfigFormSchema.safeParse(form).success).toBe(true);
    expect(configPatch(alain, form)).toEqual({});
    expect(
      configPatch(alain, {
        ...form,
        villageCode: '',
        storekeeperSlot: Number.NaN,
        role: 'villager',
        actionTiming: '',
        placeWhereWork: { ...form.placeWhereWork, x: 13 },
      }),
    ).toEqual({
      role: 'villager',
      villageCode: null,
      storekeeperSlot: null,
      placeWhereWork: {
        uuid: ids.m0012Depot,
        planet: 'tarsis_3',
        position: { x: 13, y: 0, z: -4 },
      },
      actionTiming: {},
    });
  });

  it('refuses a place given without its coordinates', () => {
    const form = configFormValues(npc(ids.denis));
    const result = ConfigFormSchema.safeParse({ ...form, home: { ...form.home, uuid: 'x' } });
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual([
      'home.x',
      'home.y',
      'home.z',
    ]);
  });
});
