// Minimal stub for @react-native-voice/voice used by Vitest.
// Tests can override individual handlers via the exported callbacks object.

import { vi } from 'vitest';

type SpeechResultsEvent = { value?: string[] };
type SpeechErrorEvent = { error?: { message?: string } | string };

const Voice = {
  onSpeechPartialResults: null as ((e: SpeechResultsEvent) => void) | null,
  onSpeechResults: null as ((e: SpeechResultsEvent) => void) | null,
  onSpeechError: null as ((e: SpeechErrorEvent) => void) | null,

  start: vi.fn((_locale: string) => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
  destroy: vi.fn(() => Promise.resolve()),
  removeAllListeners: vi.fn(),
};

export default Voice;
