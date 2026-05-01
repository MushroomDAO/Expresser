import { useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { gestures } from '../theme/tokens';

interface Callbacks {
  onPress: () => void;
  onRelease: (recordedMs: number) => void;
  onCancel: () => void;
  onUpThreshold: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

/**
 * Reanimated v4 gesture for the petal button.
 *
 * Behaviour mirrors design_handoff_expresser/source/phone-app.jsx:
 *  - press ≥ 130ms before motion → start recording
 *  - up-drag > 80px → switch to camera (callback owns the transition)
 *  - horizontal swipe |dx|>16 & ratio>1.4 → cancel record, classify L/R on release
 *  - release < 600ms recording → treat as misfire, do not enter pool
 */
export function usePetalGesture(cbs: Callbacks) {
  // Ref-based state — we use UI thread + JS thread bridges via runOnJS.
  const startRef = useRef<{ x: number; y: number; t: number; recording: boolean; swipe: boolean; upFired: boolean } | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const begin = (x: number, y: number) => {
    startRef.current = { x, y, t: Date.now(), recording: false, swipe: false, upFired: false };
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => {
      const s = startRef.current;
      if (!s || s.swipe) return;
      s.recording = true;
      cbs.onPress();
    }, gestures.pressDelayMs);
  };

  const moveJS = (dx: number, dy: number) => {
    const s = startRef.current;
    if (!s) return;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (!s.recording && adx > gestures.swipeMinDx && adx > ady * gestures.swipeAxisRatio) {
      // horizontal swipe — abort the press timer
      s.swipe = true;
      if (armTimer.current) clearTimeout(armTimer.current);
      return;
    }
    if (s.swipe) return;

    // vertical up — Reanimated y axis: dy negative = up. We use positive = up.
    if (s.recording && !s.upFired && -dy > gestures.swipeUpPx) {
      s.upFired = true;
      cbs.onUpThreshold();
    }
  };

  const endJS = (dx: number) => {
    const s = startRef.current;
    if (!s) return;
    if (armTimer.current) clearTimeout(armTimer.current);
    const dur = Date.now() - s.t;

    if (s.swipe) {
      if (dx < -gestures.swipeReleasePx) cbs.onSwipeLeft();
      else if (dx > gestures.swipeReleasePx) cbs.onSwipeRight();
      else cbs.onCancel();
    } else if (s.recording) {
      if (dur < gestures.recordMinMs) cbs.onCancel();
      else cbs.onRelease(dur);
    } else {
      cbs.onCancel();
    }
    startRef.current = null;
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(begin)(e.x, e.y);
    })
    .onUpdate((e) => {
      runOnJS(moveJS)(e.translationX, e.translationY);
    })
    .onEnd((e) => {
      runOnJS(endJS)(e.translationX);
    })
    .onFinalize(() => {
      runOnJS(endJS)(0);
    });

  return pan;
}
