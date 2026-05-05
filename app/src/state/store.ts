import { File } from 'expo-file-system';
import { create } from 'zustand';
import type {
  CameraMode,
  Piece,
  State,
  TargetId,
  Variant,
} from '../types';

interface AppStore {
  // ── runtime state ──
  state: State;
  pool: Piece[];
  windowStart: number;          // ms epoch — pool window start
  windowMin: number;            // configurable 10–60, default 30

  // capture-side ephemeral
  transcript: string;
  recSeconds: number;
  camMode: CameraMode;

  // publish flow
  progress: number;
  publishedTo: TargetId[];
  ctd: number;

  // compose
  draftPicks: Record<string, boolean>;

  // user prefs
  variant: Variant;
  dark: boolean;
  primaryColor: string;

  // offline
  online: boolean;
  offlineQueueCount: number;

  // ── actions ──
  setState: (s: State) => void;
  setTranscript: (s: string) => void;
  setRecSeconds: (s: number) => void;
  setCamMode: (m: CameraMode) => void;
  setProgress: (p: number) => void;
  setPublishedTo: (t: TargetId[]) => void;
  setCtd: (n: number) => void;
  togglePick: (pieceId: string) => void;
  setDraftPicks: (picks: Record<string, boolean>) => void;
  cycleVariant: () => Variant;
  setDark: (d: boolean) => void;
  setOnline: (o: boolean) => void;

  pushPiece: (piece: Piece) => void;
  removePiece: (pieceId: string) => void;
  resetPool: () => void;
}

/**
 * Pure helper — share of `windowMin` minutes elapsed since `windowStart`.
 *
 * Don't call inside a zustand selector: it reads `Date.now()` and would make
 * `useSyncExternalStore`'s snapshot drift every frame, looping React.
 */
export function computeWindowProgress(windowStart: number, windowMin: number): number {
  const elapsedMin = (Date.now() - windowStart) / 60000;
  return Math.max(0, Math.min(1, elapsedMin / windowMin));
}

const VARIANTS: Variant[] = ['petal', 'rainbow', 'siri', 'glass'];

export const useApp = create<AppStore>((set, get) => ({
  state: 'idle',
  pool: [],
  windowStart: Date.now(),
  windowMin: 30,

  transcript: '',
  recSeconds: 0,
  camMode: 'auto',

  progress: 0,
  publishedTo: [],
  ctd: 5,

  draftPicks: {},

  variant: 'petal',
  dark: false,
  primaryColor: '#e87aa3',

  online: true,
  offlineQueueCount: 0,

  setState: (s) => set({ state: s }),
  setTranscript: (s) => set({ transcript: s }),
  setRecSeconds: (s) => set({ recSeconds: s }),
  setCamMode: (m) => set({ camMode: m }),
  setProgress: (p) => set({ progress: p }),
  setPublishedTo: (t) => set({ publishedTo: t }),
  setCtd: (n) => set({ ctd: n }),
  togglePick: (id) =>
    set((s) => ({ draftPicks: { ...s.draftPicks, [id]: !s.draftPicks[id] } })),
  setDraftPicks: (picks) => set({ draftPicks: picks }),
  cycleVariant: () => {
    const cur = get().variant;
    const next = VARIANTS[(VARIANTS.indexOf(cur) + 1) % VARIANTS.length];
    set({ variant: next });
    return next;
  },
  setDark: (d) => set({ dark: d }),
  setOnline: (o) => set({ online: o }),

  pushPiece: (piece) =>
    set((s) => {
      const allPicks = { ...s.draftPicks, [piece.id]: true };
      return { pool: [...s.pool, piece], draftPicks: allPicks };
    }),

  removePiece: (pieceId) => {
    // Read blobUri outside the reducer to keep set() pure.
    // In React StrictMode reducers are invoked twice; side-effects here would
    // fire twice and the second call would throw on an already-deleted file.
    const piece = useApp.getState().pool.find((p) => p.id === pieceId);
    if (piece?.blobUri) {
      try { new File(piece.blobUri).delete(); } catch { /* best-effort */ }
    }
    useApp.setState((s) => {
      const pool = s.pool.filter((p) => p.id !== pieceId);
      const draftPicks = { ...s.draftPicks };
      delete draftPicks[pieceId];
      return { pool, draftPicks };
    });
  },

  resetPool: () =>
    set({ pool: [], draftPicks: {}, windowStart: Date.now() }),
}));
