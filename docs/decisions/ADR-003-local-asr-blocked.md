# ADR-003 本地 ASR 集成受阻（whisper.rn × expo-file-system v19）

**状态**: 受阻 — 等待上游修复  
**日期**: 2026-05-01  
**决策人**: jhfnetboy  
**关联**: ADR-001（ASR 模型选型）、ADR-002（Expo SDK 升级）

---

## 背景

ADR-001 决定采用 `whisper.rn` 进行本地 ASR。在将 Expo SDK 升级至 54（见 ADR-002）后，EAS 构建开始失败。

---

## 根本原因

`whisper.rn` v0.5.4（截至 2026-05-01 的最新版本）在内部调用了
`EXFileSystemInterface.getPathPermissions`。该方法在 `expo-file-system` v18 时已被移除，
v19（~19.0.22）中同样不存在。Expo SDK 54 要求 `expo-file-system ~19.0.22`，
导致运行时在 iOS 和 Android 均崩溃。

```
ReferenceError: EXFileSystemInterface.getPathPermissions is not a function
```

---

## 调查结论

| 检查项 | 结果 |
|---|---|
| whisper.rn 最新版 | 0.5.4（2026-05-01，无新版） |
| 是否修复 expo-file-system v19 | 否，所有已发布版本均受影响 |
| npm 上的兼容 fork | 未找到（搜索关键词：whisper.rn expo-file-system v19） |
| 降级 expo-file-system | 不可行，SDK 54 强制要求 v19 |
| 升级 expo-file-system | 不可行，超出 SDK 54 兼容范围 |

---

## 当前决策（方案 C：保持 Mock）

在上游修复之前，本地 ASR 维持 mock 实现：

- `app/src/api/asr/whisper.ts`：导出 `whisperTranscribe()`，符合 `TranscribeHandle` 接口
- Mock 行为：500ms 延迟后触发一次 `onChunk`，返回固定占位文字
- 所有屏幕层代码通过 `ApiClient.transcribe()` 调用，不感知底层实现
- `app/src/api/asr/__tests__/whisper.test.ts`：验证接口契约，与具体实现无关

---

## 解锁条件（任一满足时启动真实集成）

1. **whisper.rn 发布兼容版本**：`npm info whisper.rn version` 显示 > 0.5.4，
   且 changelog/release notes 明确提及修复 `EXFileSystemInterface.getPathPermissions` 错误

2. **出现可用的社区 fork**：npm 上出现兼容 expo-file-system v19 的 whisper.rn fork，
   且维护状态良好

3. **替换底层引擎**：若等待时间过长，可评估 ADR-001 中备选的
   `react-native-vosk`（单语英文/中文）或待 sherpa-onnx 发布官方 RN 包后迁移

---

## 真实集成步骤（解锁后执行）

```bash
# 1. 安装修复版
cd app
pnpm add whisper.rn@latest

# 2. 下载模型文件（42 MB）
mkdir -p app/assets/models
# 从 https://huggingface.co/ggerganov/whisper.cpp 下载
# ggml-tiny-q8_0.bin → app/assets/models/

# 3. 替换 whisper.ts 中的 mock 实现为真实 whisper.rn 调用
# 参考 whisper.ts 文件顶部注释中的迁移说明

# 4. 移除 metro.config.js 中的 whisper stub（如有）

# 5. 验证
pnpm typecheck && pnpm test
```

---

## 影响评估

| 维度 | 影响 |
|---|---|
| 用户体验 | 录音后显示占位文字，功能不可用但不崩溃 |
| 架构 | 零影响，接口层完全隔离，真实实现替换时改动限于 `asr/whisper.ts` |
| 测试 | 接口契约测试已就绪，真实实现接入后无需修改测试 |
| 构建 | 无原生模块，EAS 构建正常通过 |
