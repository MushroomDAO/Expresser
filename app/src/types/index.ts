// Mirrors the type definitions in design_handoff_expresser/README.md §State Management.

export type State =
  | 'idle'
  | 'recording'
  | 'transcribing'      // stop pressed — waiting for final ASR result before saving
  | 'transition'
  | 'camera'
  | 'capturing'
  | 'recording_video'
  | 'pool'
  | 'countdown'
  | 'compose'
  | 'processing'
  | 'uploading'
  | 'published'
  | 'offline';

export type PieceKind = 'voice' | 'photo' | 'video';
export type CoverTone = 'warm' | 'cool' | 'mint';

export interface Piece {
  id: string;
  kind: PieceKind;
  t: string;          // capture timestamp HH:MM
  dur?: string;       // for voice/video — formatted MM:SS
  text?: string;      // ASR transcript
  tag?: string;       // auto-classified tag
  cover?: CoverTone;
  blobUri?: string;
}

export type TargetId = 'blog' | 'feed' | 'reels' | 'nas';

export interface Target {
  id: TargetId;
  label: string;
  sub: string;
}

export interface DraftPayload {
  pieces: Piece[];
  createdAt: number;
}

export type Variant = 'petal' | 'rainbow' | 'siri' | 'glass';
export type CameraMode = 'auto' | 'portrait' | 'night' | 'object';
