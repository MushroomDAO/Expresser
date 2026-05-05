# UX & 代码审查 001

**日期**: 2026-05-01  
**分支**: feat/asr-whisper (包含 feat/native-integrations 所有代码)  
**审查者**: Claude (代码 + 挑剔用户视角)  

---

## P0 — 会导致崩溃或静默数据损坏

### BUG-01 `flashTimer` 泄漏 — 录音中途被重置
**文件**: `app/src/screens/HomeScreen.tsx`  
**位置**: `startRecording()` 函数入口  

`pool` 状态持续 1800ms 后回 `idle`，期间 `flashTimer` 仍在跑。用户在 pool 期间再次按住开始新录音，1800ms 后 flashTimer 触发 `setTranscript('')` 和 `setRecSeconds(0)`，当场清空正在进行的录音文字和计时。

```ts
// 当前代码 — startRecording 入口没有清 flashTimer
const startRecording = useCallback(() => {
  setState('recording');
  setTranscript('');
  // 缺少: if (flashTimer.current) clearTimeout(flashTimer.current);
  ...
```

**修法**: 在 `startRecording` 第一行加 `if (flashTimer.current) clearTimeout(flashTimer.current)`.

---

### BUG-02 `warmupAsr()` 从未被调用
**文件**: `app/src/api/asr/index.ts` (已导出) / `App.tsx` 或 `HomeScreen.tsx` (未调用)  

`initWhisperAdapter()` 要在首次录音前完成初始化，否则 `makeWhisperAdapter().start()` 会 throw `"Whisper not initialized"`. `warmupAsr()` 已经写好但没有任何地方调用它。

真机 prebuild 后第一次按住录音 → 直接崩溃。

**修法**: 在 `App.tsx` 的 `useEffect` 里调 `warmupAsr()`.

---

### BUG-03 `onUpThreshold` 无防抖 — 可重复触发
**文件**: `app/src/gestures/usePetalGesture.ts:49`  

`moveJS` 在每次 `onUpdate` 都会检查 `-dy > swipeUpPx`。用户上滑超过 80px 后继续移动，`onUpThreshold` 会连续触发多次，每次都 `cancelRecording()` + `setState('transition')` + 新建 `flashTimer`。

`flashTimer.current` 被反复覆盖 → 只有最后一个 timeout 执行，导致 camera 进场时间不可预测。

**修法**: 在 `startRef.current` 上加 `upFired: boolean` 标志位，触发一次后 guard。

---

## P1 — 明显 UX 破坏，用户会注意到

### BUG-04 录音计时器 "XX:60" 显示 Bug
**文件**: `app/src/screens/ContextText.tsx:10`  

```ts
const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toFixed(0).padStart(2, '0')}`;
```

`toFixed(0)` 对 59.5s 返回 `"60"` → 屏幕显示 `"00:60"`，应改为 `Math.floor(s % 60).toString()`.

---

### BUG-05 相机快门长按竞态 — 视频录制后停不下来
**文件**: `app/src/screens/CameraScreen.tsx`, `onShutterOut` 函数  

`startVideo()` 内部调 `setRecording(true)` 是异步 React state 更新。`onShutterOut` 检查 `recording` 这个 state 值，但在 320ms 长按计时器刚触发后立即松手时，React 渲染还没跑，`recording` 仍是 `false`。

结果: `longPressTimer.current` 为 null（已触发），`recording === false`（未渲染） → 两个分支都不走 → 既不调 `stopVideo()` 也不调 `takePhoto()` → 视频无法停止，只能等 maxDuration(120s) 到期。

**修法**: 用 `useRef` 替代 `useState` 来跟踪录制状态，或在 `startVideo` 里同步设一个 ref。

---

### BUG-06 发布后看不到目标列表
**文件**: `app/src/screens/HomeScreen.tsx`  

`state === 'published'` 时，`DraftToast` 返回 `null`（因为 `pool.length > 0` 但 state 不是 idle/pool），`ContextText` 只显示"已发布到 X 个目标"。设计稿要求底部有 4 个目标卡片，但 HomeScreen 没有渲染这部分 UI。

---

### BUG-07 左滑换样式无视觉反馈
**文件**: `app/src/screens/HomeScreen.tsx`  

设计稿: 左滑后屏幕中央闪现 700ms 样式名 (`PETAL` / `RAINBOW` / `SIRI` / `GLASS`)。代码里只调了 `cycleVariant()`，没有 `swipeFlash` UI。用户滑完不知道有没有生效。

---

### BUG-08 `PetalButton` 只实现了 `petal` 变体
**文件**: `app/src/components/PetalButton.tsx`  

`variant` 状态机有 `petal / rainbow / siri / glass` 四种，但 `PetalButton` 完全忽略 `variant` 属性，只画花瓣。循环切换后按钮外观没有任何变化。

---

## P2 — 体验缺失，用户会困惑

### UX-01 窗口进度条不实时更新
**文件**: `Header.tsx`, `Toast.tsx`  

`computeWindowProgress(windowStart, windowMin)` 在渲染时调用一次，不随时间流逝自动刷新。Header pill 的 `X/30min` 和 Toast 底部进度条只在其他 state 变化时才重新计算，实际是"静态快照"。

**修法**: 加一个 `useEffect` + `setInterval(, 60_000)` 触发强制刷新，或用 `useTimer` hook。

---

### UX-02 首次使用无模型下载进度提示
**文件**: `app/src/api/asr/model.ts`  

`getModelPath()` 会下载 42MB，过程无 UI 反馈。首次按住录音会卡住数秒甚至更长（视网速），用户以为按钮坏了。

**修法**: 在 App 启动时调 `warmupAsr()` 并提供下载进度弹窗（或在首次录音时提示"正在加载语音模型…"）。

---

### UX-03 相机顶栏遮挡刘海/灵动岛
**文件**: `app/src/screens/CameraScreen.tsx:topBar`  

`position: absolute, top: 16` 在有刘海的 iPhone 上会被遮挡。需要 `useSafeAreaInsets()` 加上顶部安全区高度。

---

### UX-04 空池进入 Compose 没有引导语
**文件**: `app/src/screens/ComposeView.tsx`  

右滑进入 Compose 而 pool 为空时，"合成并发布 (0)" 按钮被 disable，但没有说明为什么。用户看到一个空列表和灰色按钮，不知道下一步。

**修法**: 当 `pool.length === 0` 时渲染"先录一些片段再来挑选吧 ✦"空态文字。

---

### UX-05 Android 返回键无处理
**文件**: `app/src/screens/ComposeView.tsx`, `CameraScreen.tsx`  

这两个全屏视图在 Android 上按系统返回键会直接退出 App 或行为未定义。需要 `useEffect` + `BackHandler.addEventListener('hardwareBackPress', ...)`.

---

### UX-06 深色模式不持久化
**文件**: `app/src/state/store.ts`  

`dark: false` 存于内存，重启 App 恢复浅色。用户切到深色后重启会被"打回原形"。

**修法**: 用 `zustand/middleware` 的 `persist` + `AsyncStorage`，只持久化 `dark` 和 `variant` 两个字段。

---

### UX-07 倒计时环是静态圆，不是动画扫描
**文件**: `app/src/components/PetalButton.tsx`  

`ctd` 状态时画了一个完整圆圈，设计稿要求是 5 秒从满到空的扫描环（`strokeDasharray` + CSS 动画）。

---

## P3 — 细节打磨

| 编号 | 文件 | 描述 |
|---|---|---|
| P3-01 | `usePetalGesture.ts` | `onRelease(dur)` 传了 duration 但 HomeScreen 忽略，自己重算，轻微不一致 |
| P3-02 | `CameraScreen.tsx` | 没有前置/后置摄像头切换按钮 |
| P3-03 | `store.ts` | `online` 字段永远不被真实网络监听器更新（无 NetInfo 集成） |
| P3-04 | `HomeScreen.tsx` | `transition` 状态期间手势仍然激活（520ms 时间窗口）|
| P3-05 | `CameraScreen.tsx` | 相机模式 (PORTRAIT/NIGHT/OBJECT) 目前只是 UI，不影响实际拍摄参数 |
| P3-06 | `store.ts` | `windowMin` 只有默认值 30，无用户 UI 可更改（设计稿说"可配 10–60"）|

---

## 后续计划

### 分支与 PR 策略

```
main
 └── feat/native-integrations   ← fix P0/P1 bugs here, open PR → main
       └── feat/asr-whisper     ← rebase onto fixed native-integrations, open PR → main
```

**工作顺序**:
1. 在 `feat/native-integrations` 上 fix P0(BUG-01,03) + P1(BUG-04,05,06,07) + 选做 P2
2. Push → 开 PR #1: `feat/native-integrations → main`  
3. `git rebase feat/native-integrations` on `feat/asr-whisper`，push → 开 PR #2
4. 两个 PR 都 review + merge 后：

### 本地模拟器测试

```bash
cd app
npx expo prebuild --clean        # 生成 ios/ android/
npx expo run:ios                 # 启动 Xcode 模拟器 (需要 Xcode 已安装)
# 或
npx expo run:android             # 启动 Android 模拟器 (需要 Android Studio AVD)
```

iOS 模拟器可以直接在当前 Mac 上跑，无需真机。whisper.rn 在模拟器上是否能跑需要验证（CoreML 模拟器版本可能受限）。

### Android 真机导出

```bash
cd app
npx expo build:android --type apk   # Expo EAS 或
npx expo run:android --device       # 连接真机 USB 调试
```

---

## 优先级排序（建议修复顺序）

```
立即修: BUG-01 BUG-02 BUG-03 BUG-04 BUG-05
本轮修: BUG-06 BUG-07 BUG-08 UX-01 UX-03 UX-05
下轮修: UX-02 UX-04 UX-06 UX-07
待定:   P3 系列
```
