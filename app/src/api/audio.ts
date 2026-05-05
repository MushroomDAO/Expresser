// Real audio capture via expo-av. The recorder writes a local file URI; the
// transcription itself is a separate concern handled by the ASR layer.
//
// Note (2026-04): expo-av is on a deprecation path in favour of expo-audio.
// We keep expo-av for now because the project depends on SDK 54's bundled
// version; migration TODO is filed in tracking.

import { Audio } from 'expo-av';
import { File } from 'expo-file-system';

import { TRANSCRIPT_CHUNKS } from '../state/samples';
import type { TranscribeHandle } from './types';

export interface RecordingHandle {
  stop: () => Promise<{ uri: string | null; durationMs: number }>;
  cancel: () => Promise<void>;
}

/** Request mic permission and start an .m4a recording. */
export async function startRecording(): Promise<RecordingHandle> {
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Microphone permission denied');
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  const startedAt = Date.now();

  return {
    stop: async () => {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      return { uri, durationMs: Date.now() - startedAt };
    },
    cancel: async () => {
      // Capture the URI before stopping — expo-av clears it after unload.
      // Use recording.getURI() (expo-av API), NOT recorder.uri (expo-audio API).
      const uri = recording.getURI();
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // already stopped — ignore
      }
      // Delete the temp file so it doesn't accumulate in the cache directory.
      if (uri) {
        try { new File(uri).delete(); } catch { /* best-effort */ }
      }
    },
  };
}

/**
 * ASR adapter — wraps a streaming text source.
 *
 * Today we only have a mock chunk stream: Expo Go does not expose a native
 * speech recognizer. When we move off Expo Go (prebuild) we'll add an
 * implementation backed by:
 *   - iOS:     SFSpeechRecognizer  (via @react-native-voice/voice or a custom module)
 *   - Android: SpeechRecognizer    (same lib)
 *   - Cloud:   POST audio file to Whisper / DeepSeek ASR
 *
 * The stream API stays the same so the UI doesn't change.
 */
export function startASRStream(onChunk: (text: string) => void): TranscribeHandle {
  // Mock chunk emitter — the only safe option in the Expo Go runtime.
  let i = 0;
  let last = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    last = TRANSCRIPT_CHUNKS[Math.min(i, TRANSCRIPT_CHUNKS.length - 1)];
    onChunk(last);
    i += 1;
    if (i < TRANSCRIPT_CHUNKS.length * 2) timer = setTimeout(tick, 380);
  };
  timer = setTimeout(tick, 50);
  return {
    cancel: () => {
      if (timer) clearTimeout(timer);
      return last;
    },
    finish: async () => {
      if (timer) clearTimeout(timer);
      return last || TRANSCRIPT_CHUNKS[Math.min(i, TRANSCRIPT_CHUNKS.length - 1)] || '';
    },
  };
}
