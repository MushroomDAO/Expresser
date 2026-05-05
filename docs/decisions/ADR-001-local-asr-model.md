# ADR-001 本地 ASR 模型选型

**状态**: 已采纳  
**日期**: 2026-05-01  
**决策人**: jhfnetboy  

---

## 背景

Expresser 的核心交互是"按住说话"——每次录音需要实时流式转录，结果显示在屏幕中央。  
需求：

- 离线运行，不依赖云端 API（隐私、延迟、NAS 架构一致性）
- 中英文双语识别（用户日常中英夹杂）
- 模型体积适合中端手机（目标：磁盘 <200 MB，内存峰值 <512 MB）
- 架构可插拔——"可能会有更好的出现"，不要深度绑定任何单一模型

## 调研过的方案（2026-05-01）

| 方案 | RN 官方包 | 中英双语 | 推荐模型大小 | 流式 | 长期维护 |
|---|---|---|---|---|---|
| **whisper.rn** | ✅ `whisper.rn` | ✅ 99 语言 | tiny-q8_0 42 MB | 伪流式(VAD) | ✅ Stars 765, 活跃 |
| react-native-vosk | ✅ `react-native-vosk` + Config Plugin | ❌ 单语模型 | small-cn 42 MB | ✅ partial | ⚠️ Stars 94, 小规模 |
| sherpa-onnx | ❌ 无官方 RN 包（需自写桥接） | ✅ SenseVoice int8 155 MB | ~190 MB | ✅ Zipformer 真流式 | ✅ Stars 12k, 非常活跃 |

### sherpa-onnx 详细说明

精度上限最高，SenseVoice int8 (155 MB) 中文专项优化，Zipformer bilingual int8 (~190 MB) 支持真正的 token 级流式。  
**目前（2026-05-01）无官方 React Native 包**，需要自写 iOS/Android 原生桥接（ObjC/Kotlin）。工程成本高，不适合现阶段。  
参考：[sherpa-onnx 官方文档](https://k2-fsa.github.io/sherpa/onnx/index.html)

### 博客参考

- [BreezeApp 的 sherpa-onnx 实践](https://blog.mushroom.cv/blog/sherpa-onnx-breezeapp-local-ai-voice/) — 验证 sherpa-onnx 在移动端的可行性，但 Flutter 方案
- [VoxCPM2 vs sherpa-onnx 对比](https://blog.mushroom.cv/blog/voxcpm2-vs-sherpa-onnx-voice-ai-comparison/) — sherpa-onnx 综合优于 VoxCPM2，尤其在多语言场景

## 决策

**采用 `whisper.rn`，初始模型 `whisper-tiny-q8_0`（42 MB）。**

理由：
1. 唯一有官方 RN 包的双语方案，Expo prebuild 开箱支持
2. tiny-q8_0 磁盘 42 MB、内存峰值约 150 MB，满足中端机要求
3. 模型换档只需替换 ggml 文件路径，上层接口不变
4. `RealtimeTranscriber` + VAD 已能提供可接受的逐字显示体验

## 架构约束（防止深度绑定）

ASR 能力封装在 `app/src/api/asr/` 下，对外只暴露：

```ts
interface AsrAdapter {
  start(onChunk: (text: string) => void): AsrSession;
}
interface AsrSession {
  stop(): Promise<string>;   // 返回最终全文
  cancel(): void;
}
```

所有屏幕层只调用 `AsrAdapter`，不直接 import whisper.rn。  
换底层时改 `asr/index.ts` 的工厂即可，其余代码零改动。

## 未来迁移触发点

以下任一条件满足时，评估迁移到 sherpa-onnx 桥接：
- 中文 CER > 15%（tiny 质量不达标）
- sherpa-onnx 发布官方 RN npm 包
- 用户反馈流式延迟不可接受（Zipformer 真流式优势明显时）
