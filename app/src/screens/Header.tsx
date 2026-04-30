import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

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

export function Header() {
  const state = useApp((s) => s.state);
  const dark = useApp((s) => s.dark);
  const pool = useApp((s) => s.pool);
  const windowMin = useApp((s) => s.windowMin);
  const windowStart = useApp((s) => s.windowStart);
  const offlineQueueCount = useApp((s) => s.offlineQueueCount);
  const wp = computeWindowProgress(windowStart, windowMin);
  const t = themeFor(dark);

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <PetalLogo size={14} color={dark ? '#fff' : '#1d1c1a'} />
        <Text style={[styles.brandText, { color: t.fg }]}>{LABELS[state]}</Text>
      </View>

      <View>
        {state === 'idle' && pool.length > 0 && (
          <View style={[styles.pill, { backgroundColor: t.card }]}>
            <PetalLogo size={9} />
            <Text style={[styles.pillText, { color: t.fgSub }]}>
              {' '}
              {pool.length} 片段 · {Math.round(wp * windowMin)}/{windowMin}min
            </Text>
          </View>
        )}
        {state === 'offline' && (
          <View style={[styles.pill, { backgroundColor: '#e6a44b22' }]}>
            <Text style={[styles.pillText, { color: '#e6a44b' }]}>
              QUEUE {offlineQueueCount}
            </Text>
          </View>
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  pillText: { fontSize: 11.5 },
});
