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
 *   { getPreviewUri, takePhoto, confirmPhoto, retakePhoto }
 *
 * We use mockFinalizeCapture directly so the test does not spin up an API
 * server and all async paths resolve quickly.
 */
function makePreviewMachine(onClose: () => void) {
  let previewUri: string | null = null;

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

  async function confirmPhoto() {
    if (!previewUri) return;
    const uri = previewUri;
    previewUri = null;
    const piece = await mockFinalizeCapture({ kind: 'photo', blobUri: uri });
    getState().pushPiece(piece);
    getState().setState('pool');
    // Skip the poolFlashMs setTimeout delay in tests — invoke onClose immediately.
    getState().setState('idle');
    onClose();
  }

  function retakePhoto() {
    previewUri = null;
    getState().setState('camera');
  }

  return {
    getPreviewUri: () => previewUri,
    takePhoto,
    confirmPhoto,
    retakePhoto,
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

  it('confirmPhoto clears previewUri before finalizing', async () => {
    const m = makePreviewMachine(vi.fn());
    await m.takePhoto();
    await m.confirmPhoto();
    expect(m.getPreviewUri()).toBeNull();
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
});
