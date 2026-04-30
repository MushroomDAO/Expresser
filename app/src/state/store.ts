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
  resetPool: () => void;

  windowProgress: () => number;   // 0..1 — share of windowMin elapsed
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

  resetPool: () =>
    set({ pool: [], draftPicks: {}, windowStart: Date.now() }),

  windowProgress: () => {
    const { windowStart, windowMin } = get();
    const elapsedMin = (Date.now() - windowStart) / 60000;
    return Math.max(0, Math.min(1, elapsedMin / windowMin));
  },
}));
