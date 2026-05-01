import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { PetalLogo } from '../components/PetalLogo';
import { computeWindowProgress, useApp } from '../state/store';
import { themeFor } from '../theme';
import { palette } from '../theme/tokens';

interface Props {
  onTapDraft: () => void;
  onCompose: () => void;
}

export function DraftToast({ onTapDraft, onCompose }: Props) {
  const dark = useApp((s) => s.dark);
  const pool = useApp((s) => s.pool);
  const windowMin = useApp((s) => s.windowMin);
  const windowStart = useApp((s) => s.windowStart);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  void tick;
  const wp = computeWindowProgress(windowStart, windowMin);
  const t = themeFor(dark);

  if (pool.length === 0) return null;

  const minsLeft = Math.max(0, windowMin - Math.round(wp * windowMin));
  return (
    <Pressable onPress={onTapDraft} style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.92 }]}>
      <View style={[styles.card, { backgroundColor: dark ? '#1e1d1c' : '#fff' }]}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <PetalLogo size={18} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: t.fg }]}>今天的片刻正在汇集</Text>
            <Text style={[styles.sub, { color: t.fgSub }]}>
              {pool.length} 片段 · 还差 {minsLeft} 分钟自动开成一篇
            </Text>
          </View>
          <Pressable
            onPress={onCompose}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
            <Text style={styles.ctaText}>挑选</Text>
          </Pressable>
        </View>
        <View style={[styles.barTrack, { backgroundColor: dark ? '#33302e' : '#f1ebe1' }]}>
          <View style={[styles.barFill, { width: `${Math.max(8, wp * 100)}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  card: {
    borderRadius: 22,
    padding: 14,
    shadowColor: '#e87aa3',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffe9f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 11.5, marginTop: 2 },
  cta: {
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    height: 32,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  barTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: palette.primary,
  },
});
