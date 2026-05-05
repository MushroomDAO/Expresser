// Live API — HTTP-backed upload + publish. ASR is intentionally pluggable
// because Expo Go ships no native speech recognizer; see asr.ts for the
// recorder + adapter layer.

import type { DraftPayload, Piece, TargetId } from '../types';
import { mockFinalizeCapture, mockTranscribe } from './mock';
import { publishLocal } from './publish/local';
import { publishNas } from './publish/nas';
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
 * Live publish: fan-out to all user-configured targets.
 *
 * - local  : always attempted; archives to device documentDirectory
 * - nas    : attempted when NAS config exists in AsyncStorage; skipped otherwise
 * - blog / feed / reels : stubs (will integrate RSS bridge once backend is ready)
 *
 * Behaviour:
 *  - If at least one configured target succeeds, returns the list of succeeded
 *    user-facing TargetIds. Partial failures are logged but not thrown so the
 *    UI can show "published to N of M" via `publishedTo`.
 *  - If every attempted target failed (and no skipped-due-to-missing-config
 *    target counted), throws an aggregated error. HomeScreen catches this and
 *    drops into the offline state.
 *  - The local archive is internal-only and never appears in `succeeded`, but
 *    a failed local archive does count toward the failure list so we don't
 *    silently lose data.
 */
export async function livePublish(payload: DraftPayload): Promise<TargetId[]> {
  const succeeded: TargetId[] = [];
  const errors: string[] = [];
  // Track local separately — it's not user-facing TargetId but is the critical
  // archive path; if it succeeds we still consider the publish "non-empty" so
  // we don't throw just because NAS was skipped.
  let localOk = false;

  // --- local archive (internal only — not a user-facing TargetId) ---
  try {
    await publishLocal(payload);
    localOk = true;
    console.log('[publish] local archive succeeded');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[publish] local archive failed:', err);
    errors.push(`local: ${msg}`);
  }

  // --- NAS WebDAV ---
  // publishNas returns null when config is missing (intentional skip — neither
  // success nor error). Only an actual throw counts as a failure.
  try {
    const putUrl = await publishNas(payload);
    if (putUrl !== null) {
      succeeded.push('nas');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[publish] NAS WebDAV upload failed:', err);
    errors.push(`nas: ${msg}`);
  }

  // TODO: wire RSS bridge for blog/feed
  void RSS_URL; // referenced to satisfy no-unused-vars once RSS bridge is wired

  // Throw when nothing was archived and nothing was successfully published.
  // This catches the "local fails + NAS skipped" case where errors.length (1)
  // wouldn't equal attempts (2) under the old counter logic, silently swallowing
  // the local failure. We surface aggregated errors so HomeScreen can drop into
  // the offline state.
  if (!localOk && succeeded.length === 0) {
    if (errors.length > 0) {
      throw new Error(`All publish targets failed: ${errors.join('; ')}`);
    }
    // No errors AND no success AND no local archive: every target was skipped
    // (e.g. NAS config missing and local somehow not run). Still surface it so
    // the UI doesn't show a misleading "published" state.
    throw new Error(
      'No publish targets attempted (check NAS config and local archive).',
    );
  }

  return succeeded;
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
