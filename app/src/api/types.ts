// API contract — UI screens depend on this interface, not on the
// concrete client. Mock and live (HTTP) implementations both satisfy it.

import type { DraftPayload, Piece, PieceKind, TargetId } from '../types';

export interface TranscribeHandle {
  /** Cancel transcription and return whatever partial text was produced. */
  cancel: () => string;
  /** Stop transcription naturally and return the final text. */
  finish: () => Promise<string>;
}

export interface CapturePayload {
  kind: PieceKind;
  durationSec?: number;
  text?: string;
  /** Local file URI returned by expo-av / expo-camera, when available. */
  blobUri?: string;
}

export interface ProgressEvent {
  stage: 'process' | 'upload';
  progress: number;
}

export interface ApiClient {
  /** Streaming ASR. `onChunk` is invoked as partial text becomes available. */
  transcribe(onChunk: (text: string) => void): TranscribeHandle;

  /** Wrap a raw capture (voice / photo / video) into a Piece for the pool. */
  finalizeCapture(p: CapturePayload): Promise<Piece>;

  /** On-device compose step. */
  process(payload: DraftPayload, onTick: (e: ProgressEvent) => void): Promise<void>;

  /** Upload composed draft to NAS / cloud bucket. */
  upload(payload: DraftPayload, onTick: (e: ProgressEvent) => void): Promise<void>;

  /** Fan-out publish to user-configured targets, returns the targets that succeeded. */
  publish(payload: DraftPayload): Promise<TargetId[]>;
}

export type ClientMode = 'mock' | 'live';
