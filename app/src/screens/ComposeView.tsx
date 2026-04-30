import React from 'react';
import { Text, View, StyleSheet, Pressable, ScrollView } from 'react-native';

import { useApp } from '../state/store';
import { themeFor } from '../theme';
import { palette } from '../theme/tokens';
import type { Piece } from '../types';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

const KIND_EMOJI: Record<string, string> = {
  voice: '🗣',
  photo: '📷',
  video: '🎞',
};

export function ComposeView({ onConfirm, onCancel }: Props) {
  const dark = useApp((s) => s.dark);
  const pool = useApp((s) => s.pool);
  const picks = useApp((s) => s.draftPicks);
  const togglePick = useApp((s) => s.togglePick);
  const t = themeFor(dark);

  const selected = pool.filter((p) => picks[p.id]);
  const hasVideo = selected.some((p) => p.kind === 'video');
  const hint = hasVideo ? '将合成 vlog (含字幕)' : '将合成图文 blog';

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: t.fgSub }]}>COMPOSE</Text>
        <Text style={[styles.title, { color: t.fg }]}>挑选要合成的片段</Text>
        <Text style={[styles.sub, { color: t.fgSub }]}>
          {selected.length}/{pool.length} 已选 · {hint}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {pool.map((p) => (
          <Row key={p.id} piece={p} active={!!picks[p.id]} onToggle={() => togglePick(p.id)} dark={dark} />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.btn, { backgroundColor: t.card }, pressed && { opacity: 0.85 }]}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>暂停 · 继续追加</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={selected.length === 0}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            selected.length === 0 && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>合成并发布 ({selected.length})</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  piece,
  active,
  onToggle,
  dark,
}: {
  piece: Piece;
  active: boolean;
  onToggle: () => void;
  dark: boolean;
}) {
  const t = themeFor(dark);
  const desc =
    piece.kind === 'voice'
      ? piece.text || '语音片段'
      : piece.kind === 'photo'
      ? '照片'
      : `视频 · ${piece.dur ?? ''}`;
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: active ? `${palette.primary}1f` : t.card },
        active && { borderColor: palette.primary, borderWidth: 1.5 },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={[styles.thumb, { backgroundColor: dark ? '#3a3530' : '#fff' }]}>
        <Text style={{ fontSize: 22 }}>{KIND_EMOJI[piece.kind] ?? '·'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: t.fg }]} numberOfLines={2}>
          {desc}
        </Text>
        <Text style={[styles.rowMeta, { color: t.fgSub }]}>
          {piece.t} {piece.tag ? `· ${piece.tag}` : ''}
        </Text>
      </View>
      <View
        style={[
          styles.check,
          { borderColor: active ? palette.primary : t.fgSub, backgroundColor: active ? palette.primary : 'transparent' },
        ]}>
        {active && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  eyebrow: { fontSize: 11, letterSpacing: 1.98, opacity: 0.7 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  sub: { fontSize: 13, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
  },
  thumb: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '500' },
  rowMeta: { fontSize: 11, marginTop: 4 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    gap: 10,
  },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: palette.primary },
});
