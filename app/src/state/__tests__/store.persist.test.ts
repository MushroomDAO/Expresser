/**
 * store.persist.test.ts
 *
 * Verifies that pool and dark mode are correctly persisted and rehydrated
 * through zustand's persist middleware backed by AsyncStorage.
 *
 * The AsyncStorage module is replaced at the Vite alias level (vitest.config.ts)
 * so the real native module is never loaded in the Node environment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useApp } from '../store';
import type { Piece } from '../../types';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Read the raw persisted JSON from the AsyncStorage stub.
 * The stub (asyncStorage.stub.ts) stores values in a module-level map;
 * we access it indirectly via the store's persist API.
 */
async function waitForPersist(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}

const samplePiece: Piece = {
  id: 'p1',
  kind: 'voice',
  t: '09:00',
  dur: '00:30',
  text: 'hello world',
  tag: 'test',
};

// ── tests ────────────────────────────────────────────────────────────────────
describe('store persist middleware', () => {
  beforeEach(() => {
    // Reset store to a known baseline between tests
    useApp.setState({
      pool: [],
      draftPicks: {},
      state: 'idle',
      windowStart: Date.now(),
      windowMin: 30,
      transcript: '',
      recSeconds: 0,
      progress: 0,
      publishedTo: [],
      ctd: 5,
      variant: 'petal',
      dark: false,
      offlineQueueCount: 0,
    });
  });

  it('persists pool after pushPiece — pool length is reflected in state', async () => {
    useApp.getState().pushPiece(samplePiece);
    await waitForPersist();
    await useApp.persist.rehydrate();

    const pool = useApp.getState().pool;
    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe('p1');
    expect(pool[0].text).toBe('hello world');
  });

  it('persists dark flag after setDark(true)', async () => {
    useApp.getState().setDark(true);
    await waitForPersist();
    await useApp.persist.rehydrate();
    expect(useApp.getState().dark).toBe(true);
  });

  it('store persist key matches expected name', () => {
    // The persist name is used as the AsyncStorage key — verify it
    // equals the name configured in persist() options.
    expect(useApp.persist.getOptions().name).toBe('expresser-app-store');
  });

  it('rehydrate API is available on the store', () => {
    // zustand's persist middleware exposes a .persist object
    expect(useApp.persist).toBeDefined();
    expect(typeof useApp.persist.rehydrate).toBe('function');
  });

  it('does NOT expose ephemeral fields in partialize snapshot', async () => {
    useApp.getState().setTranscript('some speech');
    useApp.getState().setRecSeconds(42);
    await waitForPersist();
    await useApp.persist.rehydrate();

    // partialize only persists pool + dark + variant + draftPicks; in-memory
    // state still has ephemeral fields
    expect(useApp.getState().transcript).toBe('some speech');
    expect(useApp.getState().recSeconds).toBe(42);

    // But the persisted shape should only contain pool, dark, variant, draftPicks
    const options = useApp.persist.getOptions();
    const snapshot = (options.partialize as (s: ReturnType<typeof useApp.getState>) => unknown)(useApp.getState());
    const keys = Object.keys(snapshot as object);
    expect(keys).toContain('pool');
    expect(keys).toContain('dark');
    expect(keys).toContain('variant');
    expect(keys).toContain('draftPicks');
    expect(keys).not.toContain('transcript');
    expect(keys).not.toContain('recSeconds');
  });

  it('persists draftPicks so ComposeView selection survives app restart', async () => {
    // pushPiece sets draftPicks[id] = true; verify the selection is persisted
    useApp.getState().pushPiece(samplePiece);
    await waitForPersist();
    await useApp.persist.rehydrate();

    const picks = useApp.getState().draftPicks;
    expect(picks['p1']).toBe(true);

    // partialize snapshot should also include draftPicks with the same value
    const options = useApp.persist.getOptions();
    const snapshot = (options.partialize as (s: ReturnType<typeof useApp.getState>) => unknown)(
      useApp.getState(),
    ) as { draftPicks: Record<string, boolean> };
    expect(snapshot.draftPicks).toEqual({ p1: true });
  });

  it('persist config has version=1 for forward-compatible migrations', () => {
    // version + migrate guard against blindly hydrating old data after
    // schema changes to Piece or other persisted fields
    const options = useApp.persist.getOptions();
    expect(options.version).toBe(1);
    expect(typeof options.migrate).toBe('function');
  });
});
