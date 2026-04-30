// Single import point for screens. Switch with EXPO_PUBLIC_API_MODE.
//
//   EXPO_PUBLIC_API_MODE=mock   (default — works offline, no permissions)
//   EXPO_PUBLIC_API_MODE=live   (requires EXPO_PUBLIC_NAS_URL / RSS_URL)

import { liveClient } from './live';
import { mockClient } from './mock';
import type { ApiClient, ClientMode } from './types';

const MODE: ClientMode =
  (process.env.EXPO_PUBLIC_API_MODE as ClientMode) === 'live' ? 'live' : 'mock';

export const api: ApiClient = MODE === 'live' ? liveClient : mockClient;

export const apiMode = MODE;

export type { ApiClient, CapturePayload, ProgressEvent, TranscribeHandle } from './types';
