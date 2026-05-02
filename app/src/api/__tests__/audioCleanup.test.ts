/**
 * Unit tests for cleanupOrphanedRecordings.
 *
 * expo-file-system is fully mocked so these tests run in Node (no native module
 * needed).  We verify:
 *   - Stale .m4a files (older than maxAgeMs) are deleted.
 *   - Recent .m4a files are left untouched.
 *   - Non-.m4a files are ignored even if stale.
 *   - An empty / nonexistent cache directory returns [] without throwing.
 *   - A directory that throws on list() is handled gracefully.
 *   - Files with null modificationTime are skipped.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock helpers ──────────────────────────────────────────────────────────────

/** Minimal shape of a File entry returned by Directory.list() */
interface FakeFile {
  name: string;
  uri: string;
  /** In seconds (like the real SDK on iOS) to exercise the normalisation path */
  modificationTime: number | null;
  exists: boolean;
  delete: ReturnType<typeof vi.fn>;
}

/** Minimal shape of the Directory the cleanup module creates */
interface FakeDir {
  exists: boolean;
  list: ReturnType<typeof vi.fn>;
}

function makeFile(name: string, mtimeSec: number | null, uri?: string): FakeFile {
  return {
    name,
    uri: uri ?? `file:///cache/${name}`,
    modificationTime: mtimeSec,
    exists: true,
    delete: vi.fn(),
  };
}

// ── Shared mutable state (mutated per test) ───────────────────────────────────

let fakeDir: FakeDir = { exists: true, list: vi.fn(() => []) };

// ── Module mock ───────────────────────────────────────────────────────────────

// We declare the mock *before* importing the module under test so Vitest's
// hoisting can intercept the import.
vi.mock('expo-file-system', () => {
  // Minimal File class — only used for instanceof checks inside the cleanup.
  class File {
    constructor(_uri: string) {}
  }

  // Directory constructor always delegates to the shared fakeDir.
  class Directory {
    get exists() { return fakeDir.exists; }
    list() { return fakeDir.list(); }
  }

  const Paths = { cache: 'file:///cache/' };

  return { File, Directory, Paths };
});

// Import the class we mocked so we can patch prototypes for instanceof.
import { File as MockFileClass } from 'expo-file-system';
import { cleanupOrphanedRecordings, MAX_AGE_MS } from '../audioCleanup';

// ── Prototype patch helper ────────────────────────────────────────────────────
// cleanupOrphanedRecordings uses `entry instanceof File` — the File imported
// there is the mock class above. Patching the prototype makes our FakeFile
// objects pass the check.
function asFile(f: FakeFile) {
  Object.setPrototypeOf(f, MockFileClass.prototype);
  return f;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NOW_MS = 1_700_000_000_000; // fixed "now"
// modificationTime values in seconds (normalisation branch)
const STALE_SEC = Math.floor((NOW_MS - MAX_AGE_MS - 1000) / 1000);  // just over threshold
const FRESH_SEC = Math.floor((NOW_MS - MAX_AGE_MS + 1000) / 1000);  // just under threshold

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cleanupOrphanedRecordings', () => {
  it('deletes a stale .m4a file', async () => {
    const stale = asFile(makeFile('old.m4a', STALE_SEC));
    fakeDir = { exists: true, list: vi.fn(() => [stale]) };

    const deleted = await cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS);

    expect(stale.delete).toHaveBeenCalledOnce();
    expect(deleted).toEqual(['file:///cache/old.m4a']);
  });

  it('keeps a fresh .m4a file', async () => {
    const fresh = asFile(makeFile('new.m4a', FRESH_SEC));
    fakeDir = { exists: true, list: vi.fn(() => [fresh]) };

    const deleted = await cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS);

    expect(fresh.delete).not.toHaveBeenCalled();
    expect(deleted).toHaveLength(0);
  });

  it('ignores non-.m4a files even when stale', async () => {
    const txt = asFile(makeFile('notes.txt', STALE_SEC));
    const jpg = asFile(makeFile('photo.jpg', STALE_SEC));
    fakeDir = { exists: true, list: vi.fn(() => [txt, jpg]) };

    const deleted = await cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS);

    expect(txt.delete).not.toHaveBeenCalled();
    expect(jpg.delete).not.toHaveBeenCalled();
    expect(deleted).toHaveLength(0);
  });

  it('handles a mix: deletes stale, keeps fresh', async () => {
    const stale1 = asFile(makeFile('a.m4a', STALE_SEC, 'file:///cache/a.m4a'));
    const fresh1 = asFile(makeFile('b.m4a', FRESH_SEC, 'file:///cache/b.m4a'));
    const stale2 = asFile(makeFile('c.m4a', STALE_SEC, 'file:///cache/c.m4a'));
    fakeDir = { exists: true, list: vi.fn(() => [stale1, fresh1, stale2]) };

    const deleted = await cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS);

    expect(stale1.delete).toHaveBeenCalledOnce();
    expect(fresh1.delete).not.toHaveBeenCalled();
    expect(stale2.delete).toHaveBeenCalledOnce();
    expect(deleted).toHaveLength(2);
    expect(deleted).toContain('file:///cache/a.m4a');
    expect(deleted).toContain('file:///cache/c.m4a');
  });

  it('returns [] when cache directory does not exist', async () => {
    fakeDir = { exists: false, list: vi.fn(() => []) };

    const deleted = await cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS);

    expect(deleted).toHaveLength(0);
    expect(fakeDir.list).not.toHaveBeenCalled();
  });

  it('returns [] without throwing when Directory constructor/list throws', async () => {
    fakeDir = {
      exists: true,
      list: vi.fn(() => { throw new Error('fs error'); }),
    };

    await expect(cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS)).resolves.toEqual([]);
  });

  it('skips files where modificationTime is null', async () => {
    const noMtime = asFile(makeFile('unknown.m4a', null));
    fakeDir = { exists: true, list: vi.fn(() => [noMtime]) };

    const deleted = await cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS);

    expect(noMtime.delete).not.toHaveBeenCalled();
    expect(deleted).toHaveLength(0);
  });

  it('respects a custom maxAgeMs parameter', async () => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    // A file that is 2 hours old — stale under 1-hour threshold but fresh under default 24h.
    const twoHoursAgoSec = Math.floor((NOW_MS - ONE_HOUR_MS * 2) / 1000);
    const file = asFile(makeFile('session.m4a', twoHoursAgoSec));
    fakeDir = { exists: true, list: vi.fn(() => [file]) };

    // Should NOT be deleted under 24h default.
    const notDeleted = await cleanupOrphanedRecordings(MAX_AGE_MS, NOW_MS);
    expect(notDeleted).toHaveLength(0);

    // Should BE deleted under 1h custom threshold.
    const deleted = await cleanupOrphanedRecordings(ONE_HOUR_MS, NOW_MS);
    expect(deleted).toHaveLength(1);
  });
});
