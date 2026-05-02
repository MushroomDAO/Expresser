import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';

import { api } from '../api';
import { useApp } from '../state/store';
import { themeFor } from '../theme';
import { gestures, motion, palette } from '../theme/tokens';
import type { CameraMode } from '../types';

const MODES: { id: CameraMode; label: string; sub: string }[] = [
  { id: 'auto', label: 'AUTO', sub: '自动' },
  { id: 'portrait', label: 'PORTRAIT', sub: '人像' },
  { id: 'night', label: 'NIGHT', sub: '夜景' },
  { id: 'object', label: 'OBJECT', sub: '实物' },
];

interface Props {
  onClose: () => void;
}

export function CameraScreen({ onClose }: Props) {
  const dark = useApp((s) => s.dark);
  const camMode = useApp((s) => s.camMode);
  const setCamMode = useApp((s) => s.setCamMode);
  const setState = useApp((s) => s.setState);
  const pushPiece = useApp((s) => s.pushPiece);
  const t = themeFor(dark);
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const [facing] = useState<CameraType>('back');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recStart = useRef<number>(0);

  // ── preview state: non-null while waiting for user to confirm/retake ──
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Auto-prompt on mount.
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [perm, requestPerm]);

  // Cleanup flash timer on unmount to prevent setState-after-unmount.
  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    setState('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      // Enter preview mode — user must confirm before the photo enters the pool.
      if (photo?.uri) {
        setState('camera');
        setPreviewUri(photo.uri);
      } else {
        setState('camera');
      }
    } catch (err) {
      console.warn('photo capture failed:', err);
      setState('camera');
    }
  }, [setState]);

  /** User taps "使用" — finalize the photo and add it to the pool. */
  const confirmPhoto = useCallback(async () => {
    if (!previewUri) return;
    const uri = previewUri;
    // Do NOT clear previewUri here — wait until finalize succeeds so the user
    // can retry if the API call fails (Fix 1).
    try {
      const piece = await api.finalizeCapture({ kind: 'photo', blobUri: uri });
      setPreviewUri(null);           // Success — safe to clear now.
      pushPiece(piece);
      setState('pool');
      flashTimer.current = setTimeout(() => { setState('idle'); onClose(); }, motion.poolFlashMs);
    } catch (err) {
      console.warn('photo finalize failed:', err);
      setState('camera');
      // previewUri stays set — user can tap "使用" again to retry.
    }
  }, [previewUri, onClose, pushPiece, setState]);

  /** User taps "重拍" — discard the preview and return to viewfinder. */
  const retakePhoto = useCallback(() => {
    setPreviewUri(null);
    setState('camera');
  }, [setState]);

  const startVideo = useCallback(async () => {
    if (!cameraRef.current) return;
    recordingRef.current = true;
    setRecording(true);
    setState('recording_video');
    recStart.current = Date.now();
    try {
      const v = await cameraRef.current.recordAsync({ maxDuration: 120 });
      const dur = (Date.now() - recStart.current) / 1000;
      const piece = await api.finalizeCapture({
        kind: 'video',
        durationSec: dur,
        blobUri: v?.uri,
      });
      pushPiece(piece);
      setState('pool');
      flashTimer.current = setTimeout(() => {
        setState('idle');
        onClose();
      }, motion.poolFlashMs);
    } catch (err) {
      console.warn('video capture failed:', err);
      setState('camera');
    } finally {
      recordingRef.current = false;
      setRecording(false);
    }
  }, [onClose, pushPiece, setState]);

  const stopVideo = useCallback(() => {
    if (cameraRef.current) cameraRef.current.stopRecording();
  }, []);

  const onShutterIn = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      startVideo();
      longPressTimer.current = null;
    }, gestures.videoLongPressMs);
  }, [startVideo]);

  const onShutterOut = useCallback(() => {
    if (longPressTimer.current) {
      // long press never fired — treat as a tap → photo
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      takePhoto();
    } else if (recordingRef.current) {
      stopVideo();
    }
  }, [stopVideo, takePhoto]);

  // ── render ──
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.fallback, { backgroundColor: t.card }]}>
        <Text style={{ color: t.fg, fontWeight: '600' }}>相机仅在 iOS / Android 可用</Text>
        <Text style={{ color: t.fgSub, marginTop: 6, textAlign: 'center' }}>
          web 端用于功能 smoke 测试,请在真机/模拟器试相机功能
        </Text>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeStub, pressed && { opacity: 0.7 }]}>
          <Text style={{ color: '#fff' }}>关闭</Text>
        </Pressable>
      </View>
    );
  }

  if (!perm) {
    return (
      <View style={[styles.fallback, { backgroundColor: t.card }]}>
        <Text style={{ color: t.fgSub }}>正在请求相机权限…</Text>
      </View>
    );
  }

  if (!perm.granted) {
    return (
      <View style={[styles.fallback, { backgroundColor: t.card }]}>
        <Text style={{ color: t.fg, fontWeight: '600' }}>需要相机权限</Text>
        <Text style={{ color: t.fgSub, marginTop: 6, textAlign: 'center' }}>
          打开拍照需要授权,你可以在系统设置里随时撤回
        </Text>
        <Pressable
          onPress={requestPerm}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>授权相机</Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.dismissBtn}>
          <Text style={{ color: t.fgSub }}>取消</Text>
        </Pressable>
      </View>
    );
  }

  // ── photo preview confirm screen ──
  if (previewUri) {
    return (
      <View style={styles.root}>
        <Image
          source={{ uri: previewUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          testID="preview-image"
          onError={() => { setPreviewUri(null); setState('camera'); }}
        />
        {/* Allow closing even in preview mode — photo is silently discarded */}
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} testID="btn-close-preview">
            <Text style={styles.topBtn}>✕</Text>
          </Pressable>
          <View style={{ width: 24 }} />
          <View style={{ width: 24 }} />
        </View>
        <View style={[styles.previewActions, { bottom: insets.bottom + 32 }]}>
          <Pressable
            onPress={retakePhoto}
            style={({ pressed }) => [styles.previewBtn, styles.previewBtnRetake, pressed && { opacity: 0.7 }]}
            testID="btn-retake">
            <Text style={styles.previewBtnText}>重拍</Text>
          </Pressable>
          <Pressable
            onPress={confirmPhoto}
            style={({ pressed }) => [styles.previewBtn, styles.previewBtnUse, pressed && { opacity: 0.85 }]}
            testID="btn-use">
            <Text style={[styles.previewBtnText, { color: '#fff' }]}>使用</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={recording ? 'video' : 'picture'}
      />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable onPress={onClose} hitSlop={12} testID="btn-close-camera">
          <Text style={styles.topBtn}>✕</Text>
        </Pressable>
        <Text style={styles.modeLabel}>{MODES.find((m) => m.id === camMode)?.label}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.modeRow}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}>
        {MODES.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setCamMode(m.id)}
            style={[styles.modeChip, camMode === m.id && styles.modeChipActive]}>
            <Text style={[styles.modeChipText, camMode === m.id && { color: '#fff' }]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPressIn={onShutterIn}
        onPressOut={onShutterOut}
        style={[styles.shutterRing, recording && { borderColor: palette.recRed }]}>
        <View
          style={[
            styles.shutterInner,
            recording ? { backgroundColor: palette.recRed, borderRadius: 12, width: 44, height: 44 } : null,
          ]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBtn: {
    color: '#fff',
    fontSize: 22,
    paddingHorizontal: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  modeLabel: {
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  modeRow: {
    position: 'absolute',
    bottom: 130,
    left: 0,
    right: 0,
    flexGrow: 0,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modeChipActive: { backgroundColor: palette.primary },
  modeChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 1 },
  shutterRing: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cta: {
    backgroundColor: palette.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 18,
  },
  dismissBtn: { marginTop: 12 },
  closeStub: {
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 18,
  },
  previewActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  previewBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
  },
  previewBtnRetake: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  previewBtnUse: {
    backgroundColor: palette.primary,
  },
  previewBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
