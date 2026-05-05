/**
 * Startup cleanup for orphaned .m4a temp recording files.
 *
 * Uses expo-file-system's new File/Directory/Paths API (SDK 54 / expo-file-system ~19).
 * Any .m4a file in cacheDirectory that is older than MAX_AGE_MS is considered
 * orphaned (e.g. app crashed mid-recording) and will be deleted.
 */

import { File, Directory, Paths } from 'expo-file-system';

/** Files older than 24 hours are eligible for deletion. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Scan cacheDirectory for .m4a files older than `maxAgeMs` and delete them.
 *
 * Safe to call on every app launch — idempotent if cache dir doesn't exist or
 * contains no stale files.
 *
 * @param maxAgeMs   Age threshold in milliseconds (default: 24 h).
 * @param nowMs      Current epoch ms — injectable for testing (default: Date.now()).
 * @returns          URIs of deleted files.
 */
export async function cleanupOrphanedRecordings(
  maxAgeMs: number = MAX_AGE_MS,
  nowMs: number = Date.now(),
): Promise<string[]> {
  const deleted: string[] = [];

  let entries: (File | Directory)[];
  try {
    const cacheDir = new Directory(Paths.cache);
    if (!cacheDir.exists) return deleted;
    entries = cacheDir.list();
  } catch {
    // Cache directory unavailable (e.g. web platform) — skip silently.
    return deleted;
  }

  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (!entry.name.endsWith('.m4a')) continue;

    const mtime = entry.modificationTime;
    if (mtime == null) continue;

    // modificationTime is seconds on some platforms, milliseconds on others.
    // Normalise: if the value looks like seconds (< 2e10) convert to ms.
    const mtimeMs = mtime < 2e10 ? mtime * 1000 : mtime;

    if (nowMs - mtimeMs > maxAgeMs) {
      try {
        entry.delete();
        deleted.push(entry.uri);
      } catch {
        // Best-effort — log and continue.
        console.warn('[audioCleanup] failed to delete:', entry.uri);
      }
    }
  }

  return deleted;
}
