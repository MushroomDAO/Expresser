// System ASR adapter — wraps @react-native-voice/voice which calls
// iOS SFSpeechRecognizer (Siri on-device) or Android SpeechRecognizer.
// Only loaded in native prebuild; Expo Go and web both fall through to mock.

import Voice from '@react-native-voice/voice';
import type { TranscribeHandle } from '../types';

// Maximum time finish() will wait for the native final-result before forcing
// teardown. This is the single bound on how long finish() can take:
//   - onSpeechResults arrives  → settle immediately (fast path)
//   - onSpeechError arrives    → settle immediately (terminal failure)
//   - Voice.start rejected     → settle immediately (no events will come)
//   - none of the above        → settle after FINISH_TOTAL_TIMEOUT_MS
//
// Crucially, onSpeechEnd is NOT a settle trigger: on iOS the final
// onSpeechResults frequently lands well after onSpeechEnd, so tearing the
// recognizer down on onSpeechEnd would drop the final transcript. We keep
// the recognizer alive until either onSpeechResults lands or the total
// timeout expires.
const FINISH_TOTAL_TIMEOUT_MS = 3000;

export function systemVoiceTranscribe(onChunk: (text: string) => void): TranscribeHandle {
  let cancelled = false;
  let latestText = '';
  // Set once a *terminal* native event has fired (final result / error /
  // start rejection). finish() short-circuits on this so it never waits the
  // full timeout for events that can no longer arrive.
  // NOTE: onSpeechEnd does NOT mark the session terminal — see comment on
  // FINISH_TOTAL_TIMEOUT_MS above.
  let terminated = false;
  // Resolvers awaiting a terminal event. They are also held to the
  // FINISH_TOTAL_TIMEOUT_MS ceiling by finish() itself; this queue only wakes
  // them on the fast path.
  const terminalWaiters: (() => void)[] = [];
  const wakeFinishersImmediate = () => {
    terminated = true;
    while (terminalWaiters.length > 0) {
      const resolver = terminalWaiters.shift();
      resolver?.();
    }
  };

  // Streaming partial results — update UI as words arrive.
  Voice.onSpeechPartialResults = (e) => {
    if (!cancelled) {
      const partial = e.value?.[0] ?? '';
      if (partial) {
        latestText = partial;
        onChunk(partial);
      }
    }
  };

  // Final result from the recognizer. This is the *real* terminal signal we
  // care about — onSpeechEnd can fire well before this on iOS, so we keep
  // the recognizer alive until results land (or the total timeout expires).
  Voice.onSpeechResults = (e) => {
    if (!cancelled) {
      const final = e.value?.[0] ?? '';
      if (final) {
        latestText = final;
        onChunk(final);
      }
    }
    // Even when we already cancelled, the final-result event signals that the
    // native session has produced its last payload — wake any pending finish().
    wakeFinishersImmediate();
  };

  // Native end-of-speech signal. NOT terminal on its own — iOS frequently
  // delivers the final onSpeechResults *after* this fires. We deliberately
  // do nothing here so finish() keeps waiting for results (bounded by the
  // total timeout). Listener still registered so the native side doesn't
  // accumulate dropped events.
  Voice.onSpeechEnd = () => {
    // intentional no-op — see comment above.
  };

  Voice.onSpeechError = (e) => {
    console.warn('[SystemASR] error:', e.error?.message ?? e.error);
    // Stop emitting onChunk for this session — the recognizer is in an error
    // state and any pending events would be misleading. We deliberately do
    // not destroy() here: cancel()/finish() own teardown to avoid double
    // cleanup races.
    cancelled = true;
    // Unblock finish() if it is already awaiting events — an error means no
    // final result will ever arrive, so this is a true terminal signal.
    wakeFinishersImmediate();
  };

  // Start recognition — zh-CN by default; falls back gracefully if locale
  // unavailable on device. On failure we emit a visible fallback message so
  // the UI surface (TextEditOverlay) shows the user that ASR didn't start,
  // instead of silently producing an empty transcript.
  Voice.start('zh-CN').catch((err) => {
    console.warn('[SystemASR] start failed:', err);
    Voice.removeAllListeners();
    if (!cancelled) {
      latestText = '（语音识别启动失败，请检查权限并重试）';
      onChunk(latestText);
    }
    // Start failure is terminal — no native events will ever arrive.
    wakeFinishersImmediate();
  });

  return {
    cancel(): string {
      cancelled = true;
      wakeFinishersImmediate();
      Voice.stop().catch(() => {});
      Voice.destroy()
        .then(() => Voice.removeAllListeners())
        .catch(() => Voice.removeAllListeners());
      return latestText;
    },

    async finish(): Promise<string> {
      await Voice.stop().catch(() => {});

      // If a terminal event already fired (onSpeechResults / onSpeechError, or
      // Voice.start rejection) before finish() was called, skip the wait and
      // tear down immediately.
      if (!terminated) {
        // Otherwise wait for one of:
        //   - terminal event       → resolve immediately (fast path)
        //   - FINISH_TOTAL_TIMEOUT → hard ceiling so UI never hangs
        //
        // We deliberately do NOT settle on onSpeechEnd: on iOS the final
        // onSpeechResults frequently arrives after onSpeechEnd, sometimes by
        // more than a second. Settling early would destroy the recognizer
        // before results land and drop the final transcript.
        await new Promise<void>((resolve) => {
          let resolved = false;
          let totalTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
          const settle = () => {
            if (resolved) return;
            resolved = true;
            if (totalTimeoutTimer) clearTimeout(totalTimeoutTimer);
            resolve();
          };
          // Hard ceiling — fires even if no native event ever arrives.
          totalTimeoutTimer = setTimeout(settle, FINISH_TOTAL_TIMEOUT_MS);
          // Fast path: terminal event (results / error / start fail) lands.
          terminalWaiters.push(settle);
        });
      }

      // Now — and only now — is it safe to tear the recognizer down. Doing
      // this earlier (e.g. on onSpeechEnd) would race with the final
      // onSpeechResults landing and lose the transcript.
      await Voice.destroy().catch(() => {});
      Voice.removeAllListeners();
      return latestText;
    },
  };
}
