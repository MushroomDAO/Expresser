/**
 * Unit tests for systemVoiceTranscribe.
 *
 * @react-native-voice/voice is fully mocked so these tests run in Node with
 * no native modules.  We verify:
 *   - Voice.start is called with 'zh-CN'
 *   - onSpeechPartialResults fires onChunk and updates latestText
 *   - cancel() stops recognition immediately and returns latestText
 *   - finish() waits for onSpeechResults and returns the final text
 *   - onSpeechEnd does NOT settle finish(): results arriving 1.5s later
 *     (well after any historical "grace window") are still captured
 *   - onSpeechResults fires first → finish() resolves immediately
 *   - finish() falls back to latestText when neither end nor results fire
 *     (only the total timeout settles it; ~3000ms)
 *   - Voice.start failure surfaces a user-visible fallback message
 *   - onSpeechError stops further onChunk emissions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock @react-native-voice/voice ────────────────────────────────────────────

type SpeechResultsEvent = { value?: string[] };
type SpeechErrorEvent = { error?: { message?: string } | string };

// vi.hoisted ensures this object is created before vi.mock's factory runs,
// avoiding the "Cannot access before initialization" error caused by hoisting.
const voiceMock = vi.hoisted(() => ({
  onSpeechPartialResults: null as ((e: SpeechResultsEvent) => void) | null,
  onSpeechResults: null as ((e: SpeechResultsEvent) => void) | null,
  onSpeechEnd: null as (() => void) | null,
  onSpeechError: null as ((e: SpeechErrorEvent) => void) | null,
  start: vi.fn((_locale: string) => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
  destroy: vi.fn(() => Promise.resolve()),
  removeAllListeners: vi.fn(),
}));

vi.mock('@react-native-voice/voice', () => ({
  default: voiceMock,
}));

// Import after mock registration.
import { systemVoiceTranscribe } from '../asr/systemVoice';

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to a default resolved start; individual tests can override.
  voiceMock.start.mockImplementation((_locale: string) => Promise.resolve());
  voiceMock.stop.mockImplementation(() => Promise.resolve());
  voiceMock.destroy.mockImplementation(() => Promise.resolve());
  voiceMock.onSpeechPartialResults = null;
  voiceMock.onSpeechResults = null;
  voiceMock.onSpeechEnd = null;
  voiceMock.onSpeechError = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('systemVoiceTranscribe', () => {
  it('calls Voice.start with zh-CN', () => {
    systemVoiceTranscribe(() => {});
    expect(voiceMock.start).toHaveBeenCalledOnce();
    expect(voiceMock.start).toHaveBeenCalledWith('zh-CN');
  });

  it('fires onChunk and updates latestText when partial results arrive', () => {
    const chunks: string[] = [];
    systemVoiceTranscribe((text) => chunks.push(text));

    // Simulate the native layer firing partial results.
    voiceMock.onSpeechPartialResults?.({ value: ['你好'] });
    voiceMock.onSpeechPartialResults?.({ value: ['你好世界'] });

    expect(chunks).toEqual(['你好', '你好世界']);
  });

  it('cancel() immediately returns the latest partial text', () => {
    const handle = systemVoiceTranscribe(() => {});

    voiceMock.onSpeechPartialResults?.({ value: ['部分结果'] });
    const result = handle.cancel();

    expect(result).toBe('部分结果');
    expect(voiceMock.stop).toHaveBeenCalled();
  });

  it('cancel() returns empty string when no speech was received', () => {
    const handle = systemVoiceTranscribe(() => {});
    const result = handle.cancel();
    expect(result).toBe('');
  });

  it('finish() resolves with final text from onSpeechResults', async () => {
    const handle = systemVoiceTranscribe(() => {});

    // Schedule the final callback shortly after finish() is called.
    setTimeout(() => {
      voiceMock.onSpeechResults?.({ value: ['最终识别结果'] });
    }, 50);

    const text = await handle.finish();
    expect(text).toBe('最终识别结果');
    expect(voiceMock.stop).toHaveBeenCalled();
    expect(voiceMock.destroy).toHaveBeenCalled();
    expect(voiceMock.removeAllListeners).toHaveBeenCalled();
  });

  it('keeps the final transcript when onSpeechResults arrives shortly after onSpeechEnd', async () => {
    // iOS SFSpeechRecognizer commonly fires onSpeechEnd *before* the final
    // onSpeechResults. The recognizer must stay alive until results land;
    // otherwise the final transcript is dropped.
    const handle = systemVoiceTranscribe(() => {});

    voiceMock.onSpeechPartialResults?.({ value: ['部分文字'] });

    // onSpeechEnd fires first…
    setTimeout(() => {
      voiceMock.onSpeechEnd?.();
    }, 20);
    // …then the final results land ~150ms later.
    setTimeout(() => {
      voiceMock.onSpeechResults?.({ value: ['最终完整结果'] });
    }, 170);

    const start = Date.now();
    const text = await handle.finish();
    const elapsed = Date.now() - start;

    // The late-arriving final result must replace the partial.
    expect(text).toBe('最终完整结果');
    // Should resolve shortly after the results arrive — well below the
    // 3000ms safety timeout.
    expect(elapsed).toBeLessThan(500);
  });

  it('keeps the final transcript when onSpeechResults arrives long after onSpeechEnd (>500ms) but before total timeout', async () => {
    // Regression guard: an earlier implementation tore the recognizer down
    // 500ms after onSpeechEnd, which dropped the final transcript whenever
    // iOS delivered onSpeechResults later than that (not unusual on slow
    // devices or long utterances). The recognizer must remain alive until
    // results land OR the total 3s timeout expires.
    const handle = systemVoiceTranscribe(() => {});

    voiceMock.onSpeechPartialResults?.({ value: ['部分文字'] });

    // onSpeechEnd fires early…
    setTimeout(() => {
      voiceMock.onSpeechEnd?.();
    }, 20);
    // …results arrive 1500ms later — well past any historical grace
    // window but still inside the 3000ms safety timeout.
    setTimeout(() => {
      voiceMock.onSpeechResults?.({ value: ['迟到的最终结果'] });
    }, 1500);

    const start = Date.now();
    const text = await handle.finish();
    const elapsed = Date.now() - start;

    // The late-arriving final result must still be captured.
    expect(text).toBe('迟到的最终结果');
    // Should resolve shortly after results arrive (~1500ms), not at the
    // 3000ms ceiling.
    expect(elapsed).toBeGreaterThanOrEqual(1400);
    expect(elapsed).toBeLessThan(2000);
  });

  it('falls back to total timeout when onSpeechEnd fires but onSpeechResults never arrives', async () => {
    // If the native layer reports speech ended but never delivers a final
    // transcript, finish() now waits for the full 3s total timeout. This is
    // the correct behaviour: we cannot know whether results are still in
    // flight, so we must not destroy the recognizer prematurely.
    const handle = systemVoiceTranscribe(() => {});

    voiceMock.onSpeechPartialResults?.({ value: ['只有部分'] });

    setTimeout(() => {
      voiceMock.onSpeechEnd?.();
    }, 20);

    const start = Date.now();
    const text = await handle.finish();
    const elapsed = Date.now() - start;

    expect(text).toBe('只有部分');
    // Settled by the total timeout (~3000ms after finish() was called).
    expect(elapsed).toBeGreaterThanOrEqual(2900);
    expect(elapsed).toBeLessThan(3500);
  }, 10000);

  it('finish() resolves immediately when onSpeechResults fires before onSpeechEnd', async () => {
    // When the recognizer delivers final results directly (no separate
    // onSpeechEnd, or onSpeechEnd lands later), finish() must not impose
    // any grace window — results are the terminal signal we wanted.
    const handle = systemVoiceTranscribe(() => {});

    voiceMock.onSpeechPartialResults?.({ value: ['过渡文字'] });

    setTimeout(() => {
      voiceMock.onSpeechResults?.({ value: ['立即终结的结果'] });
    }, 20);

    const start = Date.now();
    const text = await handle.finish();
    const elapsed = Date.now() - start;

    expect(text).toBe('立即终结的结果');
    // No grace delay — should land within ~tens of ms of the results event.
    expect(elapsed).toBeLessThan(200);
  });

  it('finish() falls back to latestText after the total timeout when neither onSpeechEnd nor onSpeechResults fire', async () => {
    const handle = systemVoiceTranscribe(() => {});

    // Provide a partial result but never fire onSpeechResults or onSpeechEnd —
    // the only thing that can settle finish() now is the total timeout.
    voiceMock.onSpeechPartialResults?.({ value: ['超时前的文字'] });

    const start = Date.now();
    const text = await handle.finish();
    const elapsed = Date.now() - start;

    expect(text).toBe('超时前的文字');
    // Settled exactly by the 3000ms total timeout, not earlier.
    expect(elapsed).toBeGreaterThanOrEqual(2900);
    expect(elapsed).toBeLessThan(3500);
  }, 10000);

  it('cancel() suppresses further onChunk calls', () => {
    const chunks: string[] = [];
    const handle = systemVoiceTranscribe((text) => chunks.push(text));

    voiceMock.onSpeechPartialResults?.({ value: ['before cancel'] });
    handle.cancel();
    voiceMock.onSpeechPartialResults?.({ value: ['after cancel'] });

    expect(chunks).toEqual(['before cancel']);
  });

  it('onSpeechResults updates latestText and fires onChunk', () => {
    const chunks: string[] = [];
    systemVoiceTranscribe((text) => chunks.push(text));

    voiceMock.onSpeechResults?.({ value: ['完整句子'] });

    expect(chunks).toContain('完整句子');
  });

  it('emits a fallback chunk when Voice.start rejects so the UI shows the failure', async () => {
    voiceMock.start.mockImplementationOnce(() =>
      Promise.reject(new Error('mic permission denied')),
    );

    const chunks: string[] = [];
    const handle = systemVoiceTranscribe((text) => chunks.push(text));

    // Allow the rejected start promise's catch handler to run.
    await Promise.resolve();
    await Promise.resolve();

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[chunks.length - 1]).toContain('语音识别启动失败');
    expect(voiceMock.removeAllListeners).toHaveBeenCalled();

    // finish() should resolve immediately (no 3000ms timeout wait) because
    // the start-rejection already marked the session as terminated.
    const start = Date.now();
    const text = await handle.finish();
    const elapsed = Date.now() - start;
    expect(text).toContain('语音识别启动失败');
    expect(elapsed).toBeLessThan(500);
  });

  it('onSpeechError suppresses further onChunk emissions', () => {
    const chunks: string[] = [];
    systemVoiceTranscribe((text) => chunks.push(text));

    voiceMock.onSpeechPartialResults?.({ value: ['前半段'] });
    voiceMock.onSpeechError?.({ error: { message: 'recognizer crashed' } });
    // Any callback that fires after the error should be ignored.
    voiceMock.onSpeechPartialResults?.({ value: ['不该出现'] });
    voiceMock.onSpeechResults?.({ value: ['也不该出现'] });

    expect(chunks).toEqual(['前半段']);
  });

  it('onSpeechError unblocks a pending finish() so the UI is not stuck', async () => {
    const handle = systemVoiceTranscribe(() => {});

    voiceMock.onSpeechPartialResults?.({ value: ['错误前的部分文字'] });

    setTimeout(() => {
      voiceMock.onSpeechError?.({ error: 'boom' });
    }, 20);

    const start = Date.now();
    const text = await handle.finish();
    const elapsed = Date.now() - start;

    expect(text).toBe('错误前的部分文字');
    expect(elapsed).toBeLessThan(500);
  });
});
