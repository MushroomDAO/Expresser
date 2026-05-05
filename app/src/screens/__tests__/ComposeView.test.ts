/**
 * ComposeView store-logic tests.
 *
 * Vitest is configured for `environment: 'node'` (no DOM / RN renderer),
 * so we test the store slice that ComposeView consumes rather than rendering
 * the component itself.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { useApp } from '../../state/store';
import type { Piece } from '../../types';

const voice: Piece = { id: 'v1', kind: 'voice', t: '09:00', dur: '00:12', text: '你好世界' };
const photo: Piece = { id: 'p1', kind: 'photo', t: '09:05' };

beforeEach(() => {
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
    offlineQueueCount: 0,
  });
});

describe('ComposeView — empty state', () => {
  it('pool starts empty', () => {
    expect(useApp.getState().pool).toHaveLength(0);
  });
});

describe('ComposeView — with pieces', () => {
  it('pool contains pushed pieces', () => {
    useApp.getState().pushPiece(voice);
    useApp.getState().pushPiece(photo);
    const pool = useApp.getState().pool;
    expect(pool).toHaveLength(2);
    expect(pool[0].id).toBe('v1');
    expect(pool[1].id).toBe('p1');
  });

  it('pushed pieces are auto-selected in draftPicks', () => {
    useApp.getState().pushPiece(voice);
    expect(useApp.getState().draftPicks['v1']).toBe(true);
  });
});

describe('ComposeView — removePiece', () => {
  it('removes the piece from pool', () => {
    useApp.getState().pushPiece(voice);
    useApp.getState().pushPiece(photo);
    useApp.getState().removePiece('v1');
    const pool = useApp.getState().pool;
    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe('p1');
  });

  it('removes the piece from draftPicks', () => {
    useApp.getState().pushPiece(voice);
    expect(useApp.getState().draftPicks['v1']).toBe(true);
    useApp.getState().removePiece('v1');
    expect(useApp.getState().draftPicks['v1']).toBeUndefined();
  });

  it('removing a non-existent id is a no-op', () => {
    useApp.getState().pushPiece(voice);
    useApp.getState().removePiece('does-not-exist');
    expect(useApp.getState().pool).toHaveLength(1);
  });

  it('pool is empty after removing all pieces', () => {
    useApp.getState().pushPiece(voice);
    useApp.getState().removePiece('v1');
    expect(useApp.getState().pool).toHaveLength(0);
  });
});
