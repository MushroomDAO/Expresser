// Live API — HTTP-backed upload + publish. ASR is intentionally pluggable
// because Expo Go ships no native speech recognizer; see asr.ts for the
// recorder + adapter layer.

import type { DraftPayload, Piece, TargetId } from '../types';
import { mockFinalizeCapture, mockTranscribe } from './mock';
import type { ApiClient, CapturePayload, ProgressEvent, TranscribeHandle } from './types';

/**
 * Endpoints come from `EXPO_PUBLIC_*` env so they ship with the bundle and
 * stay overridable per build. If unset, the live methods throw a typed
 * error so the caller can fall back (e.g. queue offline).
 */
const NAS_URL = process.env.EXPO_PUBLIC_NAS_URL;
const RSS_URL = process.env.EXPO_PUBLIC_RSS_URL;

export class NotConfiguredError extends Error {
  constructor(which: 'NAS' | 'RSS') {
    super(`${which} endpoint not configured. Set EXPO_PUBLIC_${which}_URL.`);
    this.name = 'NotConfiguredError';
  }
}

export class UploadError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

/**
 * Live upload: streams progress while POSTing the draft as JSON to NAS_URL.
 * The NAS is expected to respond 200 with `{ ok: true, ... }`.
 *
 * Real binary uploads will swap this for multipart/form-data once Pieces
 * carry blobUri references.
 */
export async function liveUpload(
  payload: DraftPayload,
  onTick: (e: ProgressEvent) => void,
): Promise<void> {
  if (!NAS_URL) throw new NotConfiguredError('NAS');

  // Coarse progress: ramp 0→90 during the request, then 100 on response.
  let progress = 0;
  const ramp = setInterval(() => {
    progress = Math.min(90, progress + 5);
    onTick({ stage: 'upload', progress });
  }, 80);

  try {
    const res = await fetch(`${NAS_URL.replace(/\/$/, '')}/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new UploadError(`upload failed (${res.status})`, res.status);
    onTick({ stage: 'upload', progress: 100 });
  } finally {
    clearInterval(ramp);
  }
}

/**
 * Live publish: fan-out to user-configured targets via the RSS bridge.
 * The RSS bridge is expected to accept POST with the draft + return:
 *   { targets: ["blog", "feed", "nas"] }
 */
export async function livePublish(payload: DraftPayload): Promise<TargetId[]> {
  if (!RSS_URL) throw new NotConfiguredError('RSS');
  const res = await fetch(`${RSS_URL.replace(/\/$/, '')}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new UploadError(`publish failed (${res.status})`, res.status);
  const json = (await res.json()) as { targets?: TargetId[] };
  return json.targets ?? [];
}

/** Process is local-only (on-device compose). Use mock cadence as a stand-in. */
export async function liveProcess(payload: DraftPayload, onTick: (e: ProgressEvent) => void) {
  // Real on-device compose will live here once we wire ML Kit / MediaPipe.
  // For now we simulate the same 7%/100ms cadence so progress bars feel right.
  let p = 0;
  while (p < 100) {
    await new Promise((r) => setTimeout(r, 100));
    p = Math.min(100, p + 7);
    onTick({ stage: 'process', progress: p });
  }
  void payload;
}

/**
 * ASR: Expo Go has no built-in speech recognizer. The live adapter
 * (`makeLiveASR`) is wired in `asr.ts` once a real recorder + transcriber is
 * available. Until then, we surface the mock chunk stream so the UI keeps
 * working end-to-end.
 */
function liveTranscribe(onChunk: (text: string) => void): TranscribeHandle {
  return mockTranscribe(onChunk);
}

async function liveFinalizeCapture(p: CapturePayload): Promise<Piece> {
  // Same shape as mock; the only thing "live" carries is `blobUri` which
  // the camera / audio recorders fill in.
  return mockFinalizeCapture(p);
}

export const liveClient: ApiClient = {
  transcribe: liveTranscribe,
  finalizeCapture: liveFinalizeCapture,
  process: liveProcess,
  upload: liveUpload,
  publish: livePublish,
};
