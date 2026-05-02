/**
 * Local ASR adapter — whisper.rn (BLOCKED, method C active)
 *
 * TODO(unblock): Replace this mock with real whisper.rn once the upstream
 * expo-file-system v19 incompatibility is resolved.
 *
 * Root cause
 * ----------
 * whisper.rn v0.5.4 (latest as of 2026-05-01) calls
 * `EXFileSystemInterface.getPathPermissions` internally. That method was
 * removed in expo-file-system v18 and is absent in v19 (~19.0.22), which is
 * the version required by Expo SDK 54. This causes an EAS build crash at
 * runtime on both iOS and Android.
 *
 * Upstream tracking
 * -----------------
 * mybigday/whisper.rn — no fix released in any published version (0.5.4 is
 * still latest). No compatible community fork was found on npm.
 *
 * Migration instructions (when upstream fixes the issue)
 * -------------------------------------------------------
 *   1. pnpm add whisper.rn@latest  (inside app/)
 *   2. Remove the metro stub block from metro.config.js (see comment there)
 *   3. Replace the mock body below with the real whisper.rn implementation:
 *
 *      import { initWhisper } from 'whisper.rn';
 *      ...
 *
 *   4. Download whisper-tiny-q8_0.bin to app/assets/models/ (42 MB)
 *   5. Run pnpm typecheck && pnpm test to confirm nothing is broken.
 *
 * See also: docs/ADR-003-local-asr-blocked.md
 */

import type { TranscribeHandle } from '../types';

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** Simulated transcript text returned by the mock adapter. */
const MOCK_TRANSCRIPT =
  '（本地语音识别暂不可用，等待 whisper.rn 修复 expo-file-system v19 兼容性问题）';

/**
 * Mock whisper adapter.
 *
 * Matches the real AsrAdapter signature so UI code compiles and runs without
 * change. Simulates a 500ms processing delay before returning a fixed
 * placeholder string. The onChunk callback is fired once after the delay so
 * the UI sees a "chunk arrived" event, preventing infinite loading spinners.
 *
 * When the real whisper.rn integration is ready, swap this function body —
 * the call sites (api/index.ts and ApiClient.transcribe) remain unchanged.
 */
export function whisperTranscribe(
  onChunk: (text: string) => void
): TranscribeHandle {
  let cancelled = false;
  let partial = '';

  const runAsync = (async () => {
    // Simulate model-load + first-token latency (~500 ms in real whisper.rn)
    await sleep(500);
    if (!cancelled) {
      partial = MOCK_TRANSCRIPT;
      onChunk(partial);
    }
  })();

  return {
    cancel(): string {
      cancelled = true;
      return partial;
    },
    async finish(): Promise<string> {
      await runAsync;
      return partial;
    },
  };
}
