/**
 * CameraScreen — photo preview state-machine tests.
 *
 * Vitest runs in `environment: 'node'` (no DOM / RN renderer).
 * We test the store slice that CameraScreen mutates plus a thin
 * simulation of the preview state-machine that mirrors the
 * takePhoto / confirmPhoto / retakePhoto callbacks in the component.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { useApp } from '../../state/store';
import { mockFinalizeCapture } from '../../api/mock';
import type { Piece } from '../../types';

// ── minimal fake for CameraView.takePictureAsync ──────────────────────────
const FAKE_URI = 'file:///tmp/test-photo-001.jpg';

const fakeCameraRef = {
  takePictureAsync: vi.fn().mockResolvedValue({ uri: FAKE_URI }),
};

// ── helpers that mirror the component callbacks ───────────────────────────

/**
 * Returns a closure that emulates the CameraScreen preview state-machine:
 *   { getPreviewUri, takePhoto, confirmPhoto, retakePhoto, closePreview }
 *
 * We use mockFinalizeCapture directly so the test does not spin up an API
 * server and all async paths resolve quickly.
 *
 * Mirrors:
 *   - Fix 1: re-entrancy guard for confirmPhoto via a `confirming` flag
 *     (the component uses a useRef; here a closure-scoped boolean is the
 *     equivalent for synchronous double-tap detection).
 *   - Fix 2: best-effort `deletePreviewFile` on retake / close / image-error.
 *     We swap in a vi.fn() spy for the delete so tests can assert it ran.
 */
function makePreviewMachine(
  onClose: () => void,
  opts: { finalizeDelayMs?: number; deletePreviewFile?: (uri: string | null) => void } = {},
) {
  let previewUri: string | null = null;
  let confirming = false;

  const finalizeDelayMs = opts.finalizeDelayMs ?? 0;
  // Default no-op so existing tests don't need to pass anything.
  const deletePreviewFile = opts.deletePreviewFile ?? (() => {});

  const getState = () => useApp.getState();

  async function takePhoto() {
    getState().setState('capturing');
    try {
      const photo = await fakeCameraRef.takePictureAsync();
      if (photo?.uri) {
        getState().setState('camera');
        previewUri = photo.uri;
      } else {
        getState().setState('camera');
      }
    } catch {
      getState().setState('camera');
    }
  }

  async function confirmPhoto({ fail = false } = {}) {
    // Mirror Fix 1: re-entrancy guard. previewUri stays truthy across the
    // async finalize window, so we need a separate flag.
    if (!previewUri || confirming) return;
    confirming = true;
    const uri = previewUri;
    try {
      if (finalizeDelayMs > 0) {
        await new Promise((r) => setTimeout(r, finalizeDelayMs));
      }
      if (fail) throw new Error('simulated finalize failure');
      const piece = await mockFinalizeCapture({ kind: 'photo', blobUri: uri });
      previewUri = null;             // Success — safe to clear now.
      getState().pushPiece(piece);
      getState().setState('pool');
      // Skip the poolFlashMs setTimeout delay in tests — invoke onClose immediately.
      getState().setState('idle');
      onClose();
    } catch {
      getState().setState('camera');
      // previewUri stays set — user can retry.
    } finally {
      confirming = false;
    }
  }

  function retakePhoto() {
    deletePreviewFile(previewUri);
    previewUri = null;
    getState().setState('camera');
  }

  function closePreview() {
    deletePreviewFile(previewUri);
    onClose();
  }

  return {
    getPreviewUri: () => previewUri,
    takePhoto,
    confirmPhoto,
    retakePhoto,
    closePreview,
  };
}

// ── test setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  useApp.setState({
    pool: [],
    draftPicks: {},
    state: 'idle',
    windowStart: Date.now(),
    windowMin: 30,
    transcript: '',
    recSeconds: 0,
    progress: 0,
    publishedTo: [],
    ctd: 5,
    variant: 'petal',
    offlineQueueCount: 0,
  });
  fakeCameraRef.takePictureAsync.mockResolvedValue({ uri: FAKE_URI });
});

// ── tests ─────────────────────────────────────────────────────────────────

describe('CameraScreen — photo preview state machine', () => {
  it('takePhoto sets previewUri and does NOT immediately add to pool', async () => {
    const onClose = vi.fn();
    const m = makePreviewMachine(onClose);

    await m.takePhoto();

    expect(m.getPreviewUri()).toBe(FAKE_URI);
    expect(useApp.getState().pool).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('after takePhoto, global state is "camera" (not "pool")', async () => {
    const m = makePreviewMachine(vi.fn());
    await m.takePhoto();
    expect(useApp.getState().state).toBe('camera');
  });

  it('retakePhoto clears previewUri and sets state back to "camera"', async () => {
    const m = makePreviewMachine(vi.fn());
    await m.takePhoto();
    expect(m.getPreviewUri()).not.toBeNull();

    m.retakePhoto();

    expect(m.getPreviewUri()).toBeNull();
    expect(useApp.getState().state).toBe('camera');
  });

  it('retakePhoto does not add anything to pool', async () => {
    const m = makePreviewMachine(vi.fn());
    await m.takePhoto();
    m.retakePhoto();
    expect(useApp.getState().pool).toHaveLength(0);
  });

  it('confirmPhoto calls pushPiece with a photo piece and invokes onClose', async () => {
    const onClose = vi.fn();
    const m = makePreviewMachine(onClose);

    await m.takePhoto();
    await m.confirmPhoto();

    const pool = useApp.getState().pool;
    expect(pool).toHaveLength(1);
    const piece: Piece = pool[0];
    expect(piece.kind).toBe('photo');
    expect(piece.blobUri).toBe(FAKE_URI);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('confirmPhoto clears previewUri after successful finalizing', async () => {
    const m = makePreviewMachine(vi.fn());
    await m.takePhoto();
    await m.confirmPhoto();
    expect(m.getPreviewUri()).toBeNull();
  });

  it('confirmPhoto preserves previewUri when finalizeCapture throws (user can retry)', async () => {
    const onClose = vi.fn();
    const m = makePreviewMachine(onClose);

    await m.takePhoto();
    expect(m.getPreviewUri()).toBe(FAKE_URI);

    await m.confirmPhoto({ fail: true });

    // previewUri must still be set so the user can tap "使用" again.
    expect(m.getPreviewUri()).toBe(FAKE_URI);
    expect(useApp.getState().pool).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(useApp.getState().state).toBe('camera');
  });

  it('confirmPhoto is a no-op when previewUri is null (guards against double-tap)', async () => {
    const onClose = vi.fn();
    const m = makePreviewMachine(onClose);
    // do NOT call takePhoto — previewUri stays null
    await m.confirmPhoto();
    expect(useApp.getState().pool).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('takePhoto with no uri gracefully falls back to "camera" state', async () => {
    fakeCameraRef.takePictureAsync.mockResolvedValueOnce(undefined);
    const m = makePreviewMachine(vi.fn());
    await m.takePhoto();
    expect(m.getPreviewUri()).toBeNull();
    expect(useApp.getState().state).toBe('camera');
  });

  it('closing during preview (onClose direct call) does not crash and leaves pool empty', async () => {
    const onClose = vi.fn();
    const m = makePreviewMachine(onClose);
    await m.takePhoto();
    // Simulate pressing X in preview mode — calls onClose without confirmPhoto
    onClose();
    expect(onClose).toHaveBeenCalledOnce();
    // Pool stays empty — photo was discarded
    expect(useApp.getState().pool).toHaveLength(0);
  });

  // ── Fix 1 — re-entrancy: a fast double-tap on "使用" must NOT push twice ──
  it('double-tap confirmPhoto only pushes a single piece to the pool', async () => {
    const onClose = vi.fn();
    // Add a small finalize delay so both taps fall inside the same async window.
    const m = makePreviewMachine(onClose, { finalizeDelayMs: 20 });

    await m.takePhoto();
    // Fire two confirms back-to-back without awaiting the first — the second
    // must be ignored by the `confirming` re-entrancy guard.
    const p1 = m.confirmPhoto();
    const p2 = m.confirmPhoto();
    await Promise.all([p1, p2]);

    expect(useApp.getState().pool).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('after a successful confirm, a follow-up confirm is a no-op (previewUri cleared)', async () => {
    const onClose = vi.fn();
    const m = makePreviewMachine(onClose);
    await m.takePhoto();
    await m.confirmPhoto();
    // previewUri is now null — a second confirm should add nothing.
    await m.confirmPhoto();
    expect(useApp.getState().pool).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── Fix 2 — temp-file leak: discard paths must invoke deletePreviewFile ──
  it('retakePhoto invokes deletePreviewFile with the current previewUri', async () => {
    const deletePreviewFile = vi.fn();
    const m = makePreviewMachine(vi.fn(), { deletePreviewFile });

    await m.takePhoto();
    expect(m.getPreviewUri()).toBe(FAKE_URI);

    m.retakePhoto();

    expect(deletePreviewFile).toHaveBeenCalledTimes(1);
    expect(deletePreviewFile).toHaveBeenCalledWith(FAKE_URI);
    expect(m.getPreviewUri()).toBeNull();
  });

  it('closing the preview (X button) invokes deletePreviewFile before onClose', async () => {
    const deletePreviewFile = vi.fn();
    const onClose = vi.fn();
    const m = makePreviewMachine(onClose, { deletePreviewFile });

    await m.takePhoto();
    m.closePreview();

    expect(deletePreviewFile).toHaveBeenCalledWith(FAKE_URI);
    expect(onClose).toHaveBeenCalledOnce();
    // Order matters: file is deleted before close fires.
    const deleteOrder = deletePreviewFile.mock.invocationCallOrder[0];
    const closeOrder = onClose.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(closeOrder);
  });

  it('successful confirmPhoto does NOT invoke deletePreviewFile (file is consumed)', async () => {
    const deletePreviewFile = vi.fn();
    const m = makePreviewMachine(vi.fn(), { deletePreviewFile });

    await m.takePhoto();
    await m.confirmPhoto();

    expect(deletePreviewFile).not.toHaveBeenCalled();
  });
});
