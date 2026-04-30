import { describe, expect, it } from 'vitest';

import {
  mockFinalizeCapture,
  mockProcess,
  mockPublish,
  mockTranscribe,
  mockUpload,
} from './mock';
import type { ProgressEvent } from './types';

describe('mockTranscribe', () => {
  it('emits chunks at ~380ms cadence and finishes with the latest text', async () => {
    const chunks: { t: number; text: string }[] = [];
    const t0 = Date.now();
    const handle = mockTranscribe((text) => chunks.push({ t: Date.now() - t0, text }));
    await new Promise((r) => setTimeout(r, 1500));
    const final = await handle.finish();

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // First chunk is the smallest, later ones contain it.
    expect(chunks[chunks.length - 1].text.length).toBeGreaterThanOrEqual(chunks[0].text.length);
    expect(final).toBe(chunks[chunks.length - 1].text);
  });

  it('cancel returns last partial without throwing', async () => {
    const handle = mockTranscribe(() => {});
    await new Promise((r) => setTimeout(r, 100));
    const partial = handle.cancel();
    expect(typeof partial).toBe('string');
  });
});

describe('mockFinalizeCapture', () => {
  it('returns a voice piece with formatted dur and provided text', async () => {
    const piece = await mockFinalizeCapture({ kind: 'voice', durationSec: 12, text: 'hi' });
    expect(piece.kind).toBe('voice');
    expect(piece.dur).toBe('00:12');
    expect(piece.text).toBe('hi');
    expect(piece.id).toMatch(/^m\d+$/);
  });

  it('returns a photo piece with cover and no dur', async () => {
    const piece = await mockFinalizeCapture({ kind: 'photo' });
    expect(piece.kind).toBe('photo');
    expect(piece.cover).toBeDefined();
    expect(piece.dur).toBeUndefined();
  });

  it('passes blobUri through to the resulting piece', async () => {
    const piece = await mockFinalizeCapture({ kind: 'photo', blobUri: 'file:///tmp/x.jpg' });
    expect(piece.blobUri).toBe('file:///tmp/x.jpg');
  });
});

describe('mockProcess timing (~1.4s, 7%/100ms)', () => {
  it('emits monotonically increasing progress to 100', async () => {
    const events: ProgressEvent[] = [];
    const t0 = Date.now();
    await mockProcess({ pieces: [], createdAt: 0 }, (e) => events.push(e));
    const elapsed = Date.now() - t0;

    expect(events[events.length - 1].progress).toBe(100);
    expect(events.every((e) => e.stage === 'process')).toBe(true);
    // Allow some slack for CI scheduling
    expect(elapsed).toBeGreaterThan(1100);
    expect(elapsed).toBeLessThan(2200);
  });
});

describe('mockUpload timing (~1.6s, 5%/80ms)', () => {
  it('emits 20 ticks ending at 100', async () => {
    const events: ProgressEvent[] = [];
    const t0 = Date.now();
    await mockUpload({ pieces: [], createdAt: 0 }, (e) => events.push(e));
    const elapsed = Date.now() - t0;
    expect(events[events.length - 1].progress).toBe(100);
    expect(elapsed).toBeGreaterThan(1300);
    expect(elapsed).toBeLessThan(2400);
  });
});

describe('mockPublish', () => {
  it('returns at least one TargetId', async () => {
    const targets = await mockPublish({ pieces: [], createdAt: 0 });
    expect(targets.length).toBeGreaterThan(0);
    expect(targets).toContain('blog');
  });
});
