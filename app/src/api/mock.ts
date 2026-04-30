// Mock API surface — local stand-ins for native ASR, on-device compose, and
// NAS upload. Real implementations will replace these one-by-one without
// touching the call sites in `screens/`.

import type { CoverTone, DraftPayload, Piece, PieceKind, TargetId } from '../types';
import { TRANSCRIPT_CHUNKS } from '../state/samples';

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const fmtClock = (d = new Date()) =>
  `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

const fmtDuration = (totalSec: number) => {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const TONES: CoverTone[] = ['warm', 'cool', 'mint'];

export interface TranscribeHandle {
  /** Cancel transcription; returns the last partial transcript so the caller can decide. */
  cancel: () => string;
  /** Stop transcription naturally and return the final text. */
  finish: () => Promise<string>;
}

/**
 * Mock streaming ASR. `onChunk` fires every ~380ms with progressive text,
 * matching the design's `ex-transcript` animation timing.
 */
export function mockTranscribe(onChunk: (text: string) => void): TranscribeHandle {
  let i = 0;
  let last = '';
  const tick = () => {
    last = TRANSCRIPT_CHUNKS[Math.min(i, TRANSCRIPT_CHUNKS.length - 1)];
    onChunk(last);
    i += 1;
    if (i < TRANSCRIPT_CHUNKS.length * 2) {
      timer = setTimeout(tick, 380);
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(tick, 50);
  return {
    cancel: () => {
      if (timer) clearTimeout(timer);
      return last;
    },
    finish: async () => {
      if (timer) clearTimeout(timer);
      return last || TRANSCRIPT_CHUNKS[Math.min(i, TRANSCRIPT_CHUNKS.length - 1)] || '';
    },
  };
}

export interface CapturePayload {
  kind: PieceKind;
  durationSec?: number;
  text?: string;
}

let _idSeq = 1000;
const nextId = () => `m${_idSeq++}`;

/** Wrap a raw capture into a Piece — the post-capture handoff into the pool. */
export async function mockFinalizeCapture(p: CapturePayload): Promise<Piece> {
  await sleep(60);
  const id = nextId();
  const t = fmtClock();
  if (p.kind === 'voice') {
    return {
      id, kind: 'voice', t,
      dur: fmtDuration(p.durationSec ?? 0),
      text: p.text || '',
      tag: '心情',
    };
  }
  if (p.kind === 'photo') {
    return { id, kind: 'photo', t, tag: '街景', cover: TONES[_idSeq % TONES.length] };
  }
  return {
    id, kind: 'video', t,
    dur: fmtDuration(p.durationSec ?? 0),
    tag: '日常',
    cover: TONES[_idSeq % TONES.length],
  };
}

export interface ProgressEvent { stage: 'process' | 'upload'; progress: number; }

/** Local-side compose. ~1.4s, 7%/100ms — matches design timing. */
export async function mockProcess(_payload: DraftPayload, onTick: (e: ProgressEvent) => void) {
  let p = 0;
  while (p < 100) {
    await sleep(100);
    p = Math.min(100, p + 7);
    onTick({ stage: 'process', progress: p });
  }
}

/** NAS upload step. ~1.6s, 5%/80ms — matches design timing. */
export async function mockUpload(_payload: DraftPayload, onTick: (e: ProgressEvent) => void) {
  let p = 0;
  while (p < 100) {
    await sleep(80);
    p = Math.min(100, p + 5);
    onTick({ stage: 'upload', progress: p });
  }
}

export async function mockPublish(_payload: DraftPayload): Promise<TargetId[]> {
  await sleep(120);
  return ['blog', 'feed', 'nas'];
}
