// ASR adapter factory — selects the right transcription backend at runtime.
//
//   web          → mock  (no native speech API)
//   native build → systemVoice (iOS SFSpeechRecognizer / Android SpeechRecognizer)
//   fallback     → mock  (module unavailable: Expo Go, simulator, missing pods …)

import { Platform } from 'react-native';
import { mockTranscribe } from '../mock';
import type { TranscribeHandle } from '../types';

export interface AsrAdapter {
  start: (onChunk: (text: string) => void) => TranscribeHandle;
}

const mockAdapter: AsrAdapter = { start: mockTranscribe };

export function getAsrAdapter(): AsrAdapter {
  // Web has no native speech module.
  if (Platform.OS === 'web') return mockAdapter;

  // Native prebuild: try to load systemVoice; fall back to mock on any error
  // (e.g. Expo Go, simulator without microphone, pods not installed yet).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { systemVoiceTranscribe } = require('./systemVoice') as {
      systemVoiceTranscribe: (onChunk: (text: string) => void) => TranscribeHandle;
    };
    // 尝试访问 Voice 模块确认可用（native prebuild 才有）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-voice/voice');
    return { start: (onChunk) => systemVoiceTranscribe(onChunk) };
  } catch {
    return mockAdapter;
  }
}
