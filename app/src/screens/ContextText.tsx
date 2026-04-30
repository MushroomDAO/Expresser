import React from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';

import { useApp } from '../state/store';
import { themeFor } from '../theme';
import { typography } from '../theme/tokens';

const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toFixed(0).padStart(2, '0')}`;

interface Props {
  onCancelCountdown?: () => void;
}

export function ContextText({ onCancelCountdown }: Props) {
  const state = useApp((s) => s.state);
  const dark = useApp((s) => s.dark);
  const transcript = useApp((s) => s.transcript);
  const recSeconds = useApp((s) => s.recSeconds);
  const progress = useApp((s) => s.progress);
  const publishedTo = useApp((s) => s.publishedTo);
  const ctd = useApp((s) => s.ctd);
  const pool = useApp((s) => s.pool);
  const windowMin = useApp((s) => s.windowMin);
  const t = themeFor(dark);

  if (state === 'idle') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.eyebrow, { color: t.fgSub }]}>Hold · Speak · Bloom</Text>
        <Text style={[styles.h1, { color: t.fg }]}>
          片刻的表达,<Text style={styles.h1em}>生活的诗篇</Text>
        </Text>
        <Text style={[styles.sub, { color: t.fgSub }]}>
          自动汇成 {windowMin} 分钟一篇 · 发前 5 秒可拦
        </Text>
      </View>
    );
  }
  if (state === 'recording' || state === 'recording_video') {
    return (
      <View style={styles.wrap}>
        <View style={styles.recRow}>
          <View style={styles.recDot} />
          <Text style={[styles.mono, { color: t.fg }]}>REC  {fmt(recSeconds)}</Text>
          <Text style={{ color: t.fgSub, fontSize: 12, marginLeft: 8 }}>ASR · 本地</Text>
        </View>
        <Text style={[styles.transcript, { color: t.fg }]}>
          {transcript || <Text style={{ color: t.fgSub }}>开始说点什么…</Text>}
        </Text>
        <Text style={[styles.sub, { color: t.fgSub, marginTop: 14 }]}>
          松手保存进内容池 · 上滑切到相机
        </Text>
      </View>
    );
  }
  if (state === 'pool') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.eyebrow, { color: '#3fbe6e' }]}>+ ADDED</Text>
        <Text style={[styles.h2, { color: t.fg }]}>已存入今天的内容池</Text>
        <Text style={[styles.sub, { color: t.fgSub }]}>
          {pool.length} 个片段 · 满 {windowMin} 分钟时自动汇成草稿
        </Text>
      </View>
    );
  }
  if (state === 'countdown') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.eyebrow, { color: '#e87aa3' }]}>AUTO-DRAFT READY</Text>
        <Text style={[styles.h2, { color: t.fg }]}>{ctd} 秒后自动发布</Text>
        <Text style={[styles.sub, { color: t.fgSub }]}>
          AI 已为你拼好今早的 {pool.length} 个片段 → 一篇图文 vlog
        </Text>
        <Pressable onPress={onCancelCountdown} style={({ pressed }) => [styles.cancelBtn, { backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={{ color: t.fg, fontSize: 13, fontWeight: '600' }}>挑选片段 / 暂停</Text>
        </Pressable>
      </View>
    );
  }
  if (state === 'processing' || state === 'uploading') {
    const isLocal = state === 'processing';
    return (
      <View style={styles.wrap}>
        <Text style={[styles.eyebrow, { color: t.fgSub }]}>
          {isLocal ? 'ON-DEVICE' : 'CLOUD · NAS @ home'}
        </Text>
        <Text style={[styles.h2, { color: t.fg }]}>
          {isLocal ? '本地拼版中' : '同步到家中 NAS'}
        </Text>
        <View style={[styles.bar, { backgroundColor: t.card }]}>
          <View style={[styles.barFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={{ color: t.fgSub, fontSize: 12 }}>
            {isLocal ? '提取要点 · 选封面 · 写草稿' : '剪辑 · 配字幕 · 排版'}
          </Text>
          <Text style={[styles.mono, { color: t.fgSub, fontSize: 12 }]}>{progress}%</Text>
        </View>
      </View>
    );
  }
  if (state === 'published') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.eyebrow, { color: '#3fbe6e' }]}>PUBLISHED</Text>
        <Text style={[styles.h2, { color: t.fg }]}>已发布到 {publishedTo.length} 个目标</Text>
        <Text style={[styles.sub, { color: t.fgSub }]}>预计阅读时长 2 分钟 · 副本已存入 NAS</Text>
      </View>
    );
  }
  if (state === 'offline') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.eyebrow, { color: '#e6a44b' }]}>OFFLINE</Text>
        <Text style={[styles.h2, { color: t.fg }]}>先记着,联网后再发</Text>
      </View>
    );
  }
  return <View style={styles.wrap} />;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: typography.eyebrow.fontSize,
    letterSpacing: typography.eyebrow.letterSpacing,
    opacity: typography.eyebrow.opacity,
    marginBottom: 8,
  },
  h1: {
    ...typography.h1,
    textAlign: 'center',
  } as any,
  h1em: { fontStyle: 'italic', opacity: 0.7 },
  h2: { ...typography.h2, textAlign: 'center', marginBottom: 6 } as any,
  sub: { fontSize: 13, textAlign: 'center', marginTop: 10 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4d6a' },
  mono: { fontFamily: 'Menlo', fontSize: 13 },
  transcript: { marginTop: 10, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  cancelBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
  },
  bar: {
    width: 240,
    height: 6,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#e87aa3' },
  progressMeta: {
    width: 240,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
