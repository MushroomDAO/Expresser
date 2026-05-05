import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { PetalButton } from '../components/PetalButton';
import { api } from '../api';
import { startRecording as startAudioRecording, type RecordingHandle } from '../api/audio';
import type { TranscribeHandle } from '../api/types';
import { CameraScreen } from './CameraScreen';
import { useApp } from '../state/store';
import { themeFor } from '../theme';
import { motion, palette } from '../theme/tokens';
import { Header } from './Header';
import { ContextText } from './ContextText';
import { PoolStrip } from './PoolStrip';
import { DraftToast } from './Toast';
import { ComposeView } from './ComposeView';
import { AboutOverlay } from './AboutOverlay';
import { PoolOverlay } from './PoolOverlay';
import { usePetalGesture } from '../gestures/usePetalGesture';

export function HomeScreen() {
  const state = useApp((s) => s.state);
  const setState = useApp((s) => s.setState);
  const dark = useApp((s) => s.dark);
  const setDark = useApp((s) => s.setDark);
  const setTranscript = useApp((s) => s.setTranscript);
  const setRecSeconds = useApp((s) => s.setRecSeconds);
  const setProgress = useApp((s) => s.setProgress);
  const setPublishedTo = useApp((s) => s.setPublishedTo);
  const setCtd = useApp((s) => s.setCtd);
  const pushPiece = useApp((s) => s.pushPiece);
  const cycleVariant = useApp((s) => s.cycleVariant);
  const variant = useApp((s) => s.variant);
  const publishedTo = useApp((s) => s.publishedTo);
  const t = themeFor(dark);

  const [overlay, setOverlay] = useState<'about' | 'pool' | null>(null);
  const [swipeFlash, setSwipeFlash] = useState<string | null>(null);
  const swipeFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcribeHandle = useRef<TranscribeHandle | null>(null);
  const audioHandle = useRef<RecordingHandle | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStart = useRef<number>(0);
  const ctdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── recording lifecycle ──
  const startRecording = useCallback(() => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setState('recording');
    setTranscript('');
    setRecSeconds(0);
    recStart.current = Date.now();
    recTimer.current = setInterval(() => {
      setRecSeconds((Date.now() - recStart.current) / 1000);
    }, 100);
    transcribeHandle.current = api.transcribe((chunk) => setTranscript(chunk));

    // Real audio capture: native only. Web stays text-mock to keep the smoke
    // test self-contained.
    if (Platform.OS !== 'web') {
      startAudioRecording()
        .then((h) => {
          audioHandle.current = h;
        })
        .catch((err) => {
          // Permission denied / unsupported — keep ASR running text-only.
          console.warn('audio capture unavailable:', err?.message ?? err);
        });
    }
  }, [setState, setTranscript, setRecSeconds]);

  const stopRecording = useCallback(
    async (save: boolean) => {
      if (recTimer.current) clearInterval(recTimer.current);
      const dur = (Date.now() - recStart.current) / 1000;

      // Show "识别中…" while waiting for the final ASR result.
      if (save && transcribeHandle.current) setState('transcribing');

      const text = transcribeHandle.current
        ? await transcribeHandle.current.finish()
        : '';
      transcribeHandle.current = null;

      let blobUri: string | undefined;
      if (audioHandle.current) {
        try {
          if (save) {
            const r = await audioHandle.current.stop();
            blobUri = r.uri ?? undefined;
          } else {
            await audioHandle.current.cancel();
          }
        } catch (err) {
          console.warn('audio stop failed:', err);
        }
        audioHandle.current = null;
      }

      if (!save) {
        setTranscript('');
        setRecSeconds(0);
        setState('idle');
        return;
      }
      const piece = await api.finalizeCapture({
        kind: 'voice',
        durationSec: dur,
        text,
        blobUri,
      });
      pushPiece(piece);
      setState('pool');
      flashTimer.current = setTimeout(() => {
        setState('idle');
        setTranscript('');
        setRecSeconds(0);
      }, motion.poolFlashMs);
    },
    [pushPiece, setRecSeconds, setState, setTranscript],
  );

  const cancelRecording = useCallback(() => {
    if (transcribeHandle.current) transcribeHandle.current.cancel();
    transcribeHandle.current = null;
    if (audioHandle.current) {
      audioHandle.current.cancel().catch(() => {});
      audioHandle.current = null;
    }
    if (recTimer.current) clearInterval(recTimer.current);
    setTranscript('');
    setRecSeconds(0);
    setState('idle');
  }, [setRecSeconds, setState, setTranscript]);

  // ── countdown + publish flow ──
  const runPublishFlow = useCallback(async () => {
    const payload = { pieces: useApp.getState().pool, createdAt: Date.now() };
    setState('processing');
    setProgress(0);
    try {
      await api.process(payload, (e) => setProgress(e.progress));
      setState('uploading');
      setProgress(0);
      await api.upload(payload, (e) => setProgress(e.progress));
      const targets = await api.publish(payload);
      setPublishedTo(targets);
      setState('published');
      flashTimer.current = setTimeout(() => {
        setState('idle');
        setPublishedTo([]);
        setProgress(0);
      }, 2400);
    } catch (err) {
      console.warn('publish failed:', err);
      // Drop into offline state — user can retry from queue.
      setState('offline');
      flashTimer.current = setTimeout(() => {
        setState('idle');
        setProgress(0);
      }, 2400);
    }
  }, [setProgress, setPublishedTo, setState]);

  const startCountdown = useCallback(() => {
    setState('countdown');
    let n = 5;
    setCtd(n);
    ctdTimer.current = setInterval(() => {
      n -= 1;
      setCtd(n);
      if (n <= 0) {
        if (ctdTimer.current) clearInterval(ctdTimer.current);
        runPublishFlow();
      }
    }, 1000);
  }, [runPublishFlow, setCtd, setState]);

  const cancelCountdown = useCallback(() => {
    if (ctdTimer.current) clearInterval(ctdTimer.current);
    setState('compose');
  }, [setState]);

  const confirmCompose = useCallback(() => {
    runPublishFlow();
  }, [runPublishFlow]);

  // ── unmount cleanup ──
  useEffect(
    () => () => {
      if (recTimer.current) clearInterval(recTimer.current);
      if (ctdTimer.current) clearInterval(ctdTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (swipeFlashTimer.current) clearTimeout(swipeFlashTimer.current);
      if (transcribeHandle.current) transcribeHandle.current.cancel();
    },
    [],
  );

  // ── gesture ──
  const gesture = usePetalGesture({
    onPress: () => {
      if (state === 'idle' || state === 'pool') startRecording();
    },
    onRelease: () => stopRecording(true),
    onCancel: () => {
      if (state === 'recording') cancelRecording();
    },
    onUpThreshold: () => {
      cancelRecording();
      setState('transition');
      flashTimer.current = setTimeout(() => setState('camera'), motion.transitionMs);
    },
    onSwipeLeft: () => {
      const next = cycleVariant();
      setSwipeFlash(next.toUpperCase());
      if (swipeFlashTimer.current) clearTimeout(swipeFlashTimer.current);
      swipeFlashTimer.current = setTimeout(() => setSwipeFlash(null), motion.swipeFlashMs);
    },
    onSwipeRight: () => {
      if (state === 'idle' || state === 'pool') setState('compose');
    },
  });

  // ── render ──
  if (state === 'compose') {
    return <ComposeView onConfirm={confirmCompose} onCancel={() => setState('idle')} />;
  }
  if (state === 'camera' || state === 'capturing' || state === 'recording_video') {
    return <CameraScreen onClose={() => setState('idle')} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Header
        onAbout={() => setOverlay('about')}
        onPool={() => setOverlay('pool')}
        onToggleDark={() => setDark(!dark)}
      />

      <View style={styles.stage}>
        <ContextText onCancelCountdown={cancelCountdown} />

        <View style={{ marginTop: 28 }}>
          <GestureDetector gesture={gesture}>
            <View style={styles.petalSlot} collapsable={false}>
              <PetalButton state={state} dark={dark} color={palette.primary} />
            </View>
          </GestureDetector>
        </View>

        {state === 'idle' && (
          <View style={styles.hints}>
            <Text style={[styles.hint, { color: t.fgSub }]}>← 左滑换样式</Text>
            <Text style={[styles.hint, { color: t.fgSub }]}>↑ 上滑相机</Text>
            <Text style={[styles.hint, { color: t.fgSub }]}>→ 右滑挑选</Text>
          </View>
        )}

        {state === 'pool' && <PoolStrip />}

        {/* published target cards */}
        {state === 'published' && (
          <View style={styles.targets}>
            {(['blog', 'feed', 'reels', 'nas'] as const).map((id) => {
              const lit = publishedTo.includes(id);
              const labels: Record<string, { label: string; sub: string }> = {
                blog:  { label: 'Personal blog',   sub: 'RSS' },
                feed:  { label: 'Photo feed',       sub: 'Image + caption' },
                reels: { label: 'Short video',      sub: 'Reel' },
                nas:   { label: 'Private archive',  sub: 'NAS backup' },
              };
              return (
                <View
                  key={id}
                  style={[
                    styles.targetCard,
                    { backgroundColor: lit ? palette.success : t.card },
                  ]}>
                  <Text style={{ color: lit ? '#fff' : t.fg, fontWeight: '600', fontSize: 13 }}>
                    {lit ? '✓ ' : ''}{labels[id].label}
                  </Text>
                  <Text style={{ color: lit ? 'rgba(255,255,255,0.8)' : t.fgSub, fontSize: 11, marginTop: 2 }}>
                    {labels[id].sub}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {(state === 'idle' || state === 'pool') && (
        <DraftToast
          onTapDraft={startCountdown}
          onCompose={() => setState('compose')}
        />
      )}

      {/* swipe-left variant flash */}
      {swipeFlash && (
        <View pointerEvents="none" style={styles.swipeFlash}>
          <Text style={[styles.swipeFlashText, { color: t.fg }]}>{swipeFlash}</Text>
        </View>
      )}

      <AboutOverlay visible={overlay === 'about'} onClose={() => setOverlay(null)} />
      <PoolOverlay
        visible={overlay === 'pool'}
        onClose={() => setOverlay(null)}
        onCompose={() => setState('compose')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  petalSlot: {
    width: 188,
    height: 188,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hints: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 28,
  },
  hint: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 100,
  },
  targets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  targetCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  swipeFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  swipeFlashText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 3,
    opacity: 0.85,
  },
});
