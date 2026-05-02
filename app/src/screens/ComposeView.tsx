import React from 'react';
import { Alert, Text, View, StyleSheet, Pressable, FlatList } from 'react-native';

import { useApp } from '../state/store';
import { themeFor } from '../theme';
import { palette } from '../theme/tokens';
import type { Piece } from '../types';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

const KIND_EMOJI: Record<string, string> = {
  voice: '🎙',
  photo: '📷',
  video: '🎞',
};

export function ComposeView({ onConfirm, onCancel }: Props) {
  const dark = useApp((s) => s.dark);
  const pool = useApp((s) => s.pool);
  const removePiece = useApp((s) => s.removePiece);
  const t = themeFor(dark);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: t.fgSub }]}>COMPOSE</Text>
        <Text style={[styles.title, { color: t.fg }]}>编辑片段</Text>
        <Text style={[styles.sub, { color: t.fgSub }]}>
          {pool.length} 个片段
        </Text>
      </View>

      <FlatList
        data={pool}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: t.fgSub }]}>
              暂无内容，请先录音或拍照
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Row
            piece={item}
            onDelete={() => removePiece(item.id)}
            dark={dark}
          />
        )}
      />

      {pool.length === 0 && (
        <Text style={{ color: t.fgSub, textAlign: 'center', marginBottom: 8, fontSize: 13 }}>
          请先录音或拍照再发布
        </Text>
      )}

      <View style={styles.footer}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.btn, { backgroundColor: t.card }, pressed && { opacity: 0.85 }]}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>取消</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={pool.length === 0}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            pool.length === 0 && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>发布 ({pool.length})</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  piece,
  onDelete,
  dark,
}: {
  piece: Piece;
  onDelete: () => void;
  dark: boolean;
}) {
  const t = themeFor(dark);
  const desc =
    piece.kind === 'voice'
      ? piece.text || `语音片段${piece.dur ? ` · ${piece.dur}` : ''}`
      : piece.kind === 'photo'
      ? '照片'
      : `视频 · ${piece.dur ?? ''}`;
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: t.card },
      ]}>
      <View style={[styles.thumb, { backgroundColor: dark ? '#3a3530' : '#fff' }]}>
        <Text style={{ fontSize: 22 }}>{KIND_EMOJI[piece.kind] ?? '·'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: t.fg }]} numberOfLines={2} ellipsizeMode="tail">
          {desc}
        </Text>
        <Text style={[styles.rowMeta, { color: t.fgSub }]}>
          {piece.t} {piece.tag ? `· ${piece.tag}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() =>
          Alert.alert('删除片段', '确定要删除这个片段吗？', [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: onDelete },
          ])
        }
        accessibilityLabel="删除片段"
        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}>
        <Text style={{ color: '#e05252', fontSize: 18, fontWeight: '700' }}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  eyebrow: { fontSize: 11, letterSpacing: 1.98, opacity: 0.7 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  sub: { fontSize: 13, marginTop: 4 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },
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
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
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
