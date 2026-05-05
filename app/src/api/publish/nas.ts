/**
 * NAS WebDAV publish target.
 *
 * Reads NAS connection config:
 *   nas_url      — AsyncStorage  "http://192.168.1.100:5005/dav/expresser"
 *   nas_user     — AsyncStorage  WebDAV username
 *   nas_password — SecureStore   WebDAV password (encrypted at rest)
 *
 * If any config key is missing, logs a warning and skips upload (returns null).
 *
 * On success returns the WebDAV PUT URL used for the metadata file.
 */

import { encode as base64Encode } from 'base-64';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { DraftPayload } from '../../types';

/** Minimal AsyncStorage interface — avoids a hard dep on the package at type level. */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
}

/** Default AsyncStorage implementation (lazy import to avoid breaking web/test). */
async function getDefaultStorage(): Promise<AsyncStorageLike> {
  // Dynamic import so Jest / Vitest can easily mock this path.
  const mod = await import('@react-native-async-storage/async-storage');
  return mod.default as AsyncStorageLike;
}

interface NasConfig {
  url: string;
  user: string;
  password: string;
}

/** Detect RFC1918 / loopback IPs that don't realistically need TLS. */
function isPrivateHost(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    // 10.0.0.0/8
    if (/^10\./.test(host)) return true;
    // 172.16.0.0 — 172.31.255.255
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    // 192.168.0.0/16
    if (/^192\.168\./.test(host)) return true;
    // .local mDNS
    if (host.endsWith('.local')) return true;
    return false;
  } catch {
    return false;
  }
}

async function loadNasConfig(storage: AsyncStorageLike): Promise<NasConfig | null> {
  // nas_url and nas_user are non-sensitive — use injected storage (AsyncStorage by default).
  // nas_password is sensitive — always read from SecureStore.
  const [url, user, password] = await Promise.all([
    storage.getItem('nas_url'),
    storage.getItem('nas_user'),
    SecureStore.getItemAsync('nas_password'),
  ]);

  if (!url || !user || !password) {
    console.warn(
      '[publish/nas] NAS config incomplete (nas_url / nas_user / nas_password). Skipping WebDAV upload.',
    );
    return null;
  }

  // Refuse to ship plaintext credentials over a non-LAN, non-HTTPS URL unless
  // the user has explicitly opted in via storage.
  // Storage override: nas_allow_insecure === 'true'
  // Env override:     EXPO_PUBLIC_NAS_ALLOW_INSECURE === 'true'
  if (url.startsWith('http://') && !isPrivateHost(url)) {
    const storageOverride = await storage.getItem('nas_allow_insecure');
    const envOverride = process.env.EXPO_PUBLIC_NAS_ALLOW_INSECURE;
    const allowInsecure = storageOverride === 'true' || envOverride === 'true';
    if (!allowInsecure) {
      throw new Error(
        `[publish/nas] Refusing to send Basic Auth credentials over plaintext HTTP to non-private host "${url}". ` +
          'Use HTTPS or a private (10./172.16-31./192.168./localhost/.local) address. ' +
          'To override (NOT recommended), set nas_allow_insecure=true in AsyncStorage ' +
          'or EXPO_PUBLIC_NAS_ALLOW_INSECURE=true at build time.',
      );
    }
    console.warn(
      `[publish/nas] insecure HTTP allowed by override for "${url}". ` +
        'Basic Auth credentials will travel unencrypted.',
    );
  }

  return { url: url.replace(/\/$/, ''), user, password };
}

/**
 * Base64-encode Basic Auth credentials.
 *
 * Uses the `base-64` package (pure JS) because React Native does NOT have a
 * global `Buffer` and `btoa` only accepts Latin-1. The `base-64` package
 * accepts UTF-8 strings and handles the encoding internally.
 */
function basicAuth(user: string, password: string): string {
  return base64Encode(`${user}:${password}`);
}

/**
 * Upload draft metadata to the NAS via WebDAV PUT.
 *
 * @param payload    The draft to publish.
 * @param storage    Optionally inject a custom AsyncStorage (for tests).
 * @returns          The PUT URL on success, or null if config is missing.
 */
export async function publishNas(
  payload: DraftPayload,
  storage?: AsyncStorageLike,
): Promise<string | null> {
  const store = storage ?? (await getDefaultStorage());
  const config = await loadNasConfig(store);
  if (!config) return null;

  const timestamp = payload.createdAt.toString();
  const date = new Date(payload.createdAt);
  const dateDir =
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`;

  const putUrl = `${config.url}/${dateDir}/${timestamp}.json`;

  const body = JSON.stringify(
    {
      createdAt: payload.createdAt,
      pieces: payload.pieces.map(({ id, kind, t, dur, tag, text, cover }) => ({
        id,
        kind,
        t,
        dur,
        tag,
        text,
        cover,
      })),
    },
    null,
    2,
  );

  const authHeader = `Basic ${basicAuth(config.user, config.password)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`[publish/nas] WebDAV PUT failed: ${res.status} ${res.statusText}`);
  }

  // Upload audio blob if present — read the file bytes via expo-file-system so
  // the WebDAV server receives the actual binary, not the URI string.
  const audioPiece = payload.pieces.find((p) => p.kind === 'voice' && p.blobUri);
  if (audioPiece?.blobUri) {
    const audioUrl = `${config.url}/${dateDir}/${timestamp}.m4a`;
    const audioController = new AbortController();
    const audioTimer = setTimeout(() => audioController.abort(), 10_000);
    try {
      const src = new File(audioPiece.blobUri);
      // bytes() returns Uint8Array — fetch accepts it as a binary body.
      const audioBytes = await src.bytes();

      const audioRes = await fetch(audioUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'audio/mp4',
          Authorization: authHeader,
        },
        body: audioBytes,
        signal: audioController.signal,
      });
      if (!audioRes.ok) {
        // Audio upload is non-fatal: metadata is the source of truth.
        // Still surface the failure so the caller can decide.
        console.warn(
          `[publish/nas] Audio upload failed: ${audioRes.status} ${audioRes.statusText}`,
        );
      }
    } catch (err) {
      // Reading the audio file or fetch itself blew up — log and continue.
      console.warn('[publish/nas] Audio upload error:', err);
    } finally {
      clearTimeout(audioTimer);
    }
  }

  return putUrl;
}
