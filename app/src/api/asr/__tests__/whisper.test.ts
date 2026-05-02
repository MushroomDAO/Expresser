/**
 * Tests for the whisper ASR adapter.
 *
 * These tests verify that the adapter (currently a mock due to the
 * expo-file-system v19 / whisper.rn incompatibility) conforms to the
 * TranscribeHandle interface contract defined in api/types.ts.
 *
 * The test suite is intentionally interface-level so it can survive a
 * drop-in replacement of the mock with the real whisper.rn implementation
 * without modification.
 */

import { describe, expect, it, vi } from 'vitest';

import type { TranscribeHandle } from '../../types';
import { whisperTranscribe } from '../whisper';

// ---------------------------------------------------------------------------
// Type-level contract
// ---------------------------------------------------------------------------

// Ensure the function signature satisfies TranscribeHandle at compile time.
// If it doesn't, this const assignment will produce a TypeScript error.
const _typeCheck: (onChunk: (text: string) => void) => TranscribeHandle =
  whisperTranscribe;
void _typeCheck; // prevent "unused variable" lint warning

// ---------------------------------------------------------------------------
// Runtime behaviour
// ---------------------------------------------------------------------------

describe('whisperTranscribe', () => {
  it('returns an object with cancel (sync) and finish (async) methods', () => {
    const handle = whisperTranscribe(() => {});
    expect(typeof handle.cancel).toBe('function');
    expect(typeof handle.finish).toBe('function');
    // cancel is synchronous — it must NOT return a Promise
    const cancelResult = handle.cancel();
    // TypeScript types cancel() as returning string (not Promise), so we
    // verify the runtime type is also string.
    expect(typeof cancelResult).toBe('string');
  });

  it('cancel returns a string immediately (partial transcript)', () => {
    const handle = whisperTranscribe(() => {});
    const partial = handle.cancel();
    expect(typeof partial).toBe('string');
  });

  it('finish resolves to a string', async () => {
    const handle = whisperTranscribe(() => {});
    const result = await handle.finish();
    expect(typeof result).toBe('string');
  });

  it('invokes onChunk at least once before finish resolves', async () => {
    const chunks: string[] = [];
    const handle = whisperTranscribe((text) => chunks.push(text));
    await handle.finish();
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('each chunk passed to onChunk is a non-empty string', async () => {
    const chunks: string[] = [];
    const handle = whisperTranscribe((text) => chunks.push(text));
    await handle.finish();
    for (const chunk of chunks) {
      expect(typeof chunk).toBe('string');
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it('finish result matches the last chunk received', async () => {
    const chunks: string[] = [];
    const handle = whisperTranscribe((text) => chunks.push(text));
    const finalText = await handle.finish();
    const lastChunk = chunks[chunks.length - 1];
    expect(finalText).toBe(lastChunk);
  });

  it('cancel after finish still returns a string (idempotent)', async () => {
    const handle = whisperTranscribe(() => {});
    await handle.finish();
    const afterCancel = handle.cancel();
    expect(typeof afterCancel).toBe('string');
  });

  it('cancel before chunk fires returns empty string (no partial yet)', () => {
    // cancel is called synchronously before the 500ms mock delay
    const chunks: string[] = [];
    const handle = whisperTranscribe((text) => chunks.push(text));
    const partial = handle.cancel();
    // No time has elapsed; partial must be an empty string
    expect(partial).toBe('');
    // onChunk should never be called after cancel
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(chunks).toHaveLength(0);
        resolve();
      }, 700); // longer than the 500ms mock delay
    });
  });

  it('simulates a delay of roughly 500 ms', async () => {
    const t0 = Date.now();
    const handle = whisperTranscribe(() => {});
    await handle.finish();
    const elapsed = Date.now() - t0;
    // Allow generous slack for CI scheduler jitter (300 ms – 1000 ms)
    expect(elapsed).toBeGreaterThanOrEqual(300);
    expect(elapsed).toBeLessThan(1000);
  });
});
