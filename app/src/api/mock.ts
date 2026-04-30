// Mock implementation of ApiClient — keeps a fast, deterministic path so the
// UI can be exercised without any device permissions, network, or backend.

import type { CoverTone, DraftPayload, Piece, TargetId } from '../types';
import { TRANSCRIPT_CHUNKS } from '../state/samples';
import type { ApiClient, CapturePayload, ProgressEvent, TranscribeHandle } from './types';

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const fmtClock = (d = new Date()) =>
  `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

const fmtDuration = (totalSec: number) => {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const TONES: CoverTone[] = ['warm', 'cool', 'mint'];

let _idSeq = 1000;
const nextId = () => `m${_idSeq++}`;

export function mockTranscribe(onChunk: (text: string) => void): TranscribeHandle {
  let i = 0;
  let last = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    last = TRANSCRIPT_CHUNKS[Math.min(i, TRANSCRIPT_CHUNKS.length - 1)];
    onChunk(last);
    i += 1;
    if (i < TRANSCRIPT_CHUNKS.length * 2) timer = setTimeout(tick, 380);
  };
  timer = setTimeout(tick, 50);
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

export async function mockFinalizeCapture(p: CapturePayload): Promise<Piece> {
  await sleep(60);
  const id = nextId();
  const t = fmtClock();
  if (p.kind === 'voice') {
    return {
      id,
      kind: 'voice',
      t,
      dur: fmtDuration(p.durationSec ?? 0),
      text: p.text || '',
      tag: '心情',
      blobUri: p.blobUri,
    };
  }
  if (p.kind === 'photo') {
    return {
      id,
      kind: 'photo',
      t,
      tag: '街景',
      cover: TONES[_idSeq % TONES.length],
      blobUri: p.blobUri,
    };
  }
  return {
    id,
    kind: 'video',
    t,
    dur: fmtDuration(p.durationSec ?? 0),
    tag: '日常',
    cover: TONES[_idSeq % TONES.length],
    blobUri: p.blobUri,
  };
}

export async function mockProcess(_payload: DraftPayload, onTick: (e: ProgressEvent) => void) {
  let p = 0;
  while (p < 100) {
    await sleep(100);
    p = Math.min(100, p + 7);
    onTick({ stage: 'process', progress: p });
  }
}

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

export const mockClient: ApiClient = {
  transcribe: mockTranscribe,
  finalizeCapture: mockFinalizeCapture,
  process: mockProcess,
  upload: mockUpload,
  publish: mockPublish,
};
