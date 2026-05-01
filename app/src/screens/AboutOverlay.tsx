import React from 'react';
import { Modal, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { PetalLogo } from '../components/PetalLogo';
import { useApp } from '../state/store';
import { themeFor } from '../theme';
import { palette } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AboutOverlay({ visible, onClose }: Props) {
  const dark = useApp((s) => s.dark);
  const t = themeFor(dark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: dark ? '#1a1818' : '#fff' }]} onPress={() => {}}>
          <View style={styles.grip} />
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="关闭">
            <Text style={[styles.closeTxt, { color: t.fgSub }]}>✕</Text>
          </Pressable>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.mark}>
              <PetalLogo size={52} color={palette.primary} />
            </View>
            <Text style={[styles.eyebrow, { color: t.fgSub }]}>ABOUT</Text>
            <Text style={[styles.title, { color: t.fg }]}>Expresser</Text>
            <Text style={[styles.tag, { color: t.fgSub }]}>片刻的表达,生活的诗篇</Text>

            <Text style={[styles.p, { color: t.fg }]}>
              一颗按钮,捕捉日常碎片。无须排版、无须思考要发哪里。
            </Text>
            <Text style={[styles.p, { color: t.fgSub }]}>
              按住说话、上滑拍照、左滑换样式、右滑挑选。捕捉的内容会先汇入 30 分钟的内容池,
              满了之后 AI 自动拼成一篇图文 vlog,发前 5 秒可以拦截。
            </Text>

            <View style={styles.grid}>
              {[
                { num: '30', label: '分钟内容窗口' },
                { num: '5s', label: '发布前可拦截' },
                { num: '4', label: '同步目标' },
              ].map(({ num, label }) => (
                <View key={label} style={[styles.cell, { backgroundColor: t.card }]}>
                  <Text style={[styles.cellNum, { color: palette.primary }]}>{num}</Text>
                  <Text style={[styles.cellLabel, { color: t.fgSub }]}>{label}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.foot, { color: t.fgSub }]}>v0.2 · 私有 NAS · 本地 ASR</Text>
          </ScrollView>
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
    paddingBottom: 40,
    maxHeight: '80%',
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
  body: { paddingHorizontal: 24, paddingTop: 8 },
  mark: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textAlign: 'center', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  tag: { fontSize: 14, textAlign: 'center', marginBottom: 18 },
  p: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  grid: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  cell: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  cellNum: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  cellLabel: { fontSize: 11, textAlign: 'center' },
  foot: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
});
