import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { useApp } from '../state/store';
import { themeFor } from '../theme';
import type { Piece } from '../types';

const COVER_GRAD: Record<string, [string, string]> = {
  warm: ['#ffc59c', '#e87aa3'],
  cool: ['#b6c8ff', '#8ba3d4'],
  mint: ['#c0e6c8', '#88c79d'],
};

function PoolThumb({ piece }: { piece: Piece }) {
  if (piece.kind === 'voice') {
    return (
      <View style={styles.voiceThumb}>
        {[5, 10, 14, 8, 12, 6].map((h, i) => (
          <View
            key={i}
            style={{ width: 2, height: h, backgroundColor: '#e87aa3', marginHorizontal: 1, borderRadius: 1 }}
          />
        ))}
      </View>
    );
  }
  const [c1, c2] = COVER_GRAD[piece.cover ?? 'warm'];
  return (
    <View style={[styles.mediaThumb, { backgroundColor: c1 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c2, opacity: 0.5 }]} />
      {piece.kind === 'video' && (
        <Text style={{ color: '#fff', fontSize: 14 }}>▶</Text>
      )}
    </View>
  );
}

export function PoolStrip() {
  const dark = useApp((s) => s.dark);
  const pool = useApp((s) => s.pool);
  const t = themeFor(dark);
  const items = pool.slice(-5);

  if (items.length === 0) return null;
  return (
    <View style={styles.row}>
      {items.map((p) => (
        <View key={p.id} style={[styles.chip, { backgroundColor: t.card }]}>
          <PoolThumb piece={p} />
          <Text style={[styles.t, { color: t.fgSub }]}>{p.t}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  chip: {
    padding: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  voiceThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  t: { fontSize: 10, marginTop: 4 },
});
