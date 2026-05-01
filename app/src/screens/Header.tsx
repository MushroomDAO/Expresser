import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import { PetalLogo } from '../components/PetalLogo';
import { computeWindowProgress, useApp } from '../state/store';
import { themeFor } from '../theme';
import type { State } from '../types';

const LABELS: Record<State, string> = {
  idle: 'Expresser',
  recording: '正在听 · ASR 本地',
  transition: '打开镜头…',
  camera: '相机',
  capturing: '正在拍摄',
  recording_video: '录像中',
  pool: '已加入内容池',
  countdown: '即将自动发布',
  compose: '挑选片段',
  processing: '本地 AI 处理中',
  uploading: '同步至 NAS',
  published: '已发布',
  offline: '离线 · 已加入队列',
};

interface Props {
  onAbout?: () => void;
  onPool?: () => void;
  onToggleDark?: () => void;
}

export function Header({ onAbout, onPool, onToggleDark }: Props) {
  const state = useApp((s) => s.state);
  const dark = useApp((s) => s.dark);
  const pool = useApp((s) => s.pool);
  const windowMin = useApp((s) => s.windowMin);
  const windowStart = useApp((s) => s.windowStart);
  const offlineQueueCount = useApp((s) => s.offlineQueueCount);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const wp = computeWindowProgress(windowStart, windowMin);
  void tick; // ensure effect re-runs the progress computation each minute
  const t = themeFor(dark);
  const isIdle = state === 'idle';

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.brand}
        onPress={isIdle ? onAbout : undefined}
        accessibilityLabel="关于 Expresser">
        <PetalLogo size={14} color={dark ? '#fff' : '#1d1c1a'} />
        <Text style={[styles.brandText, { color: t.fg }]}>{LABELS[state]}</Text>
      </Pressable>

      <View style={styles.right}>
        {isIdle && pool.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.pill, { backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}
            onPress={onPool}
            accessibilityLabel="打开内容池">
            <PetalLogo size={9} />
            <Text style={[styles.pillText, { color: t.fgSub }]}>
              {' '}{pool.length} 片段 · {Math.round(wp * windowMin)}/{windowMin}min
            </Text>
          </Pressable>
        )}
        {state === 'offline' && (
          <View style={[styles.pill, { backgroundColor: '#e6a44b22' }]}>
            <Text style={[styles.pillText, { color: '#e6a44b' }]}>
              QUEUE {offlineQueueCount}
            </Text>
          </View>
        )}
        {isIdle && (
          <Pressable
            style={({ pressed }) => [styles.themeBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onToggleDark}
            accessibilityLabel={dark ? '切换到浅色主题' : '切换到深色主题'}>
            {dark ? (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.fg} strokeWidth={2}>
                <Circle cx={12} cy={12} r={4} />
                <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
              </Svg>
            ) : (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill={t.fg}>
                <Path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
              </Svg>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontWeight: '600', fontSize: 15, letterSpacing: 0.3 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  pillText: { fontSize: 11.5 },
  themeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
