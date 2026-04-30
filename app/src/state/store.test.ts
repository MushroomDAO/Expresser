import { describe, expect, it, beforeEach } from 'vitest';

import { computeWindowProgress, useApp } from './store';
import type { Piece } from '../types';

const sample: Piece = { id: 'x1', kind: 'voice', t: '08:00', dur: '00:05', text: 'hi', tag: 'test' };

describe('useApp store', () => {
  beforeEach(() => {
    useApp.setState({
      state: 'idle',
      pool: [],
      windowStart: Date.now(),
      windowMin: 30,
      transcript: '',
      recSeconds: 0,
      progress: 0,
      publishedTo: [],
      ctd: 5,
      draftPicks: {},
      variant: 'petal',
      offlineQueueCount: 0,
    });
  });

  it('pushPiece appends to pool and auto-selects in draftPicks', () => {
    useApp.getState().pushPiece(sample);
    const s = useApp.getState();
    expect(s.pool).toHaveLength(1);
    expect(s.pool[0].id).toBe('x1');
    expect(s.draftPicks.x1).toBe(true);
  });

  it('togglePick flips an entry', () => {
    useApp.getState().pushPiece(sample);
    useApp.getState().togglePick('x1');
    expect(useApp.getState().draftPicks.x1).toBe(false);
    useApp.getState().togglePick('x1');
    expect(useApp.getState().draftPicks.x1).toBe(true);
  });

  it('resetPool clears pool, picks, and resets windowStart', () => {
    useApp.getState().pushPiece(sample);
    const before = useApp.getState().windowStart;
    // tiny delay so windowStart reset is observable
    return new Promise<void>((res) => {
      setTimeout(() => {
        useApp.getState().resetPool();
        const s = useApp.getState();
        expect(s.pool).toEqual([]);
        expect(s.draftPicks).toEqual({});
        expect(s.windowStart).toBeGreaterThan(before);
        res();
      }, 10);
    });
  });

  it('cycleVariant rotates petal → rainbow → siri → glass → petal', () => {
    expect(useApp.getState().variant).toBe('petal');
    expect(useApp.getState().cycleVariant()).toBe('rainbow');
    expect(useApp.getState().cycleVariant()).toBe('siri');
    expect(useApp.getState().cycleVariant()).toBe('glass');
    expect(useApp.getState().cycleVariant()).toBe('petal');
  });

  describe('computeWindowProgress', () => {
    it('returns 0 right after window start', () => {
      const wp = computeWindowProgress(Date.now(), 30);
      expect(wp).toBeLessThan(0.001);
    });

    it('clamps to 1 when window is fully elapsed', () => {
      // windowStart 60min ago, windowMin 30 → progress would be 2 → clamp to 1
      const wp = computeWindowProgress(Date.now() - 60 * 60_000, 30);
      expect(wp).toBe(1);
    });

    it('returns 0.5 at half-elapsed window', () => {
      const wp = computeWindowProgress(Date.now() - 15 * 60_000, 30);
      expect(wp).toBeGreaterThan(0.49);
      expect(wp).toBeLessThan(0.51);
    });
  });
});
