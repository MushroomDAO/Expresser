import React from 'react';
import { Modal, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { computeWindowProgress, useApp } from '../state/store';
import { themeFor } from '../theme';
import { palette } from '../theme/tokens';
import type { Piece } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCompose: () => void;
}

const COVER_GRAD: Record<string, string> = {
  warm: '#e87aa3',
  cool: '#8ba3d4',
  mint: '#88c79d',
};

function PoolThumb({ piece }: { piece: Piece }) {
  if (piece.kind === 'voice') {
    return (
      <View style={styles.voiceThumb}>
        {[5, 10, 14, 8, 12, 6].map((h, i) => (
          <View key={i} style={{ width: 2, height: h, backgroundColor: palette.primary, marginHorizontal: 1, borderRadius: 1 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.mediaThumb, { backgroundColor: COVER_GRAD[piece.cover ?? 'warm'] }]}>
      {piece.kind === 'video' && (
        <Text style={{ color: '#fff', fontSize: 12 }}>▶</Text>
      )}
    </View>
  );
}

export function PoolOverlay({ visible, onClose, onCompose }: Props) {
  const dark = useApp((s) => s.dark);
  const pool = useApp((s) => s.pool);
  const windowMin = useApp((s) => s.windowMin);
  const windowStart = useApp((s) => s.windowStart);
  const t = themeFor(dark);
  const wp = computeWindowProgress(windowStart, windowMin);
  const remaining = Math.max(0, windowMin - Math.round(wp * windowMin));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: dark ? '#1a1818' : '#fff' }]} onPress={() => {}}>
          <View style={styles.grip} />
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="关闭">
            <Text style={[styles.closeTxt, { color: t.fgSub }]}>✕</Text>
          </Pressable>

          <View style={styles.head}>
            <Text style={[styles.eyebrow, { color: t.fgSub }]}>POOL · 内容池</Text>
            <Text style={[styles.title, { color: t.fg }]}>今天的 {pool.length} 个片段</Text>
            <Text style={[styles.tag, { color: t.fgSub }]}>还差 {remaining} 分钟自动汇成草稿</Text>
            <View style={[styles.barTrack, { backgroundColor: t.card }]}>
              <View style={[styles.barFill, { width: `${Math.max(4, wp * 100)}%` }]} />
            </View>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {pool.map((p) => (
              <View key={p.id} style={[styles.item, { backgroundColor: t.card }]}>
                <PoolThumb piece={p} />
                <View style={styles.itemBody}>
                  <View style={styles.itemRow}>
                    <Text style={[styles.itemKind, { color: t.fg }]}>
                      {p.kind === 'voice' ? '🎙' : p.kind === 'photo' ? '📷' : '🎬'} {p.tag ?? ''}
                    </Text>
                    <Text style={[styles.itemMeta, { color: t.fgSub }]}>
                      {p.t}{p.dur ? ` · ${p.dur}` : ''}
                    </Text>
                  </View>
                  {p.text ? (
                    <Text style={[styles.itemText, { color: t.fgSub }]} numberOfLines={2}>{p.text}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => { onClose(); onCompose(); }}>
              <Text style={styles.btnTxt}>立即挑选合成</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 0,
  },
  grip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { fontSize: 16 },
  head: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 14 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  tag: { fontSize: 13, marginBottom: 12 },
  barTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: palette.primary },
  list: { paddingHorizontal: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    gap: 12,
  },
  voiceThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(232,122,163,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  itemKind: { fontSize: 12, fontWeight: '600' },
  itemMeta: { fontSize: 11, fontFamily: 'Menlo' },
  itemText: { fontSize: 12, lineHeight: 18 },
  actions: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  btn: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
