/**
 * Unit tests for publish/local and publish/nas.
 *
 * expo-file-system (SDK 54 File/Directory/Paths API) is mocked so no real
 * FS I/O occurs. fetch is replaced with a vi.fn() stub for WebDAV assertions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── shared state buckets (hoisted so the vi.mock factory can reference them) ─

const state = vi.hoisted(() => ({
  createdDirs: [] as string[],
  writtenFiles: [] as { uri: string; content: string }[],
  copiedFiles: [] as { from: string; to: string }[],
  secureStore: {} as Record<string, string>,
}));

// ─── expo-secure-store mock ───────────────────────────────────────────────────

vi.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(state.secureStore[key] ?? null),
  setItemAsync: (key: string, value: string) => {
    state.secureStore[key] = value;
    return Promise.resolve();
  },
  deleteItemAsync: (key: string) => {
    delete state.secureStore[key];
    return Promise.resolve();
  },
}));

// ─── base-64 mock ─────────────────────────────────────────────────────────────
// The package exists but is plain ESM; Node's Buffer is the most reliable
// reference encoder for our assertions, and using it here means the test
// continues to verify that the auth header round-trips through real base64.
vi.mock('base-64', () => ({
  encode: (s: string) => Buffer.from(s, 'utf8').toString('base64'),
  decode: (s: string) => Buffer.from(s, 'base64').toString('utf8'),
}));

// ─── expo-file-system mock ────────────────────────────────────────────────────
//
// Mocks the SDK-54 class-based API:
//   new Directory(...)  → dir.create({intermediates,idempotent}) / dir.exists / dir.uri
//   new File(...)       → file.write() / file.copy() / file.bytes() / file.uri

vi.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    exists = false;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('');
      if (!this.uri.endsWith('/')) this.uri += '/';
    }
    create(_opts?: { intermediates?: boolean; idempotent?: boolean }) {
      this.exists = true;
      state.createdDirs.push(this.uri);
    }
  }

  class MockFile {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('');
    }
    write(content: string) {
      state.writtenFiles.push({ uri: this.uri, content });
    }
    copy(dest: { uri: string }) {
      state.copiedFiles.push({ from: this.uri, to: dest.uri });
    }
    async bytes(): Promise<Uint8Array> {
      // Return a deterministic payload so we can assert PUT body shape.
      return new Uint8Array([0xff, 0xfb, 0x90, 0x44]); // arbitrary "audio" bytes
    }
  }

  const docDir = new MockDirectory('file:///data/user/0/com.expresser/files/');

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: docDir },
  };
});

// ─── imports after mocks ──────────────────────────────────────────────────────
import { publishLocal } from '../publish/local';
import { publishNas } from '../publish/nas';
import type { AsyncStorageLike } from '../publish/nas';
import type { DraftPayload } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeDraft(overrides?: Partial<DraftPayload>): DraftPayload {
  return {
    createdAt: new Date('2025-03-15T10:30:00.000Z').getTime(),
    pieces: [
      {
        id: 'p1',
        kind: 'voice',
        t: '10:30',
        dur: '00:42',
        text: 'Hello world',
        tag: '心情',
        blobUri: 'file:///tmp/recording.m4a',
      },
    ],
    ...overrides,
  };
}

/**
 * Build a mock AsyncStorageLike for nas_url / nas_user, and populate the
 * SecureStore mock state with the password (nas_password lives in SecureStore).
 */
function makeNasStorage(
  url = 'http://192.168.1.100:5005/dav/expresser',
  user = 'admin',
  password = 'secret',
): AsyncStorageLike {
  // Password is stored in SecureStore, not AsyncStorage.
  state.secureStore['nas_password'] = password;

  const store: Record<string, string> = {
    nas_url: url,
    nas_user: user,
  };
  return {
    getItem: (key: string) => Promise.resolve(store[key] ?? null),
  };
}

// ─── publishLocal ─────────────────────────────────────────────────────────────

describe('publishLocal', () => {
  beforeEach(() => {
    state.createdDirs.length = 0;
    state.writtenFiles.length = 0;
    state.copiedFiles.length = 0;
  });

  it('creates directory with YYYY-MM-DD path', async () => {
    const draft = makeDraft();
    await publishLocal(draft);

    expect(state.createdDirs.length).toBeGreaterThan(0);
    // The dated directory must be among the created directories.
    expect(state.createdDirs.some((d) => /expresser\/\d{4}-\d{2}-\d{2}\/$/.test(d))).toBe(true);
  });

  it('creates the expresser parent directory before the dated child', async () => {
    const draft = makeDraft();
    await publishLocal(draft);

    // Parent (expresser/) must be created before the dated child so we don't
    // hit "containing folder doesn't exist" on a fresh install.
    const parentIdx = state.createdDirs.findIndex((d) => d.endsWith('expresser/'));
    const childIdx = state.createdDirs.findIndex((d) => /expresser\/\d{4}-\d{2}-\d{2}\/$/.test(d));
    expect(parentIdx).toBeGreaterThanOrEqual(0);
    expect(childIdx).toBeGreaterThanOrEqual(0);
    expect(parentIdx).toBeLessThan(childIdx);
  });

  it('writes transcript .txt and metadata .json using the timestamp as stem', async () => {
    const draft = makeDraft();
    await publishLocal(draft);

    const ts = draft.createdAt.toString();
    const uris = state.writtenFiles.map((f) => f.uri);
    expect(uris.some((u) => u.includes(`${ts}.txt`))).toBe(true);
    expect(uris.some((u) => u.includes(`${ts}.json`))).toBe(true);
  });

  it('copies audio blob to <timestamp>.m4a when blobUri is present', async () => {
    const draft = makeDraft();
    await publishLocal(draft);

    expect(state.copiedFiles).toHaveLength(1);
    expect(state.copiedFiles[0].from).toBe('file:///tmp/recording.m4a');
    expect(state.copiedFiles[0].to).toMatch(/\.m4a/);
  });

  it('does NOT copy when no voice blobUri exists', async () => {
    const draft = makeDraft({
      pieces: [{ id: 'p2', kind: 'photo', t: '10:31', tag: '街景' }],
    });
    await publishLocal(draft);
    expect(state.copiedFiles).toHaveLength(0);
  });

  it('returns the directory URI it wrote to', async () => {
    const draft = makeDraft();
    const dir = await publishLocal(draft);
    expect(dir).toMatch(/expresser.*\d{4}-\d{2}-\d{2}/);
  });
});

// ─── publishNas ───────────────────────────────────────────────────────────────

describe('publishNas', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, statusText: 'Created' });
    vi.stubGlobal('fetch', fetchMock);
    // Reset SecureStore mock state between tests.
    Object.keys(state.secureStore).forEach((k) => delete state.secureStore[k]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('constructs PUT URL as <nas_url>/YYYY-MM-DD/<timestamp>.json', async () => {
    const draft = makeDraft();
    const storage = makeNasStorage('http://192.168.1.100:5005/dav/expresser');

    const putUrl = await publishNas(draft, storage);

    expect(putUrl).not.toBeNull();
    expect(putUrl).toMatch(
      /^http:\/\/192\.168\.1\.100:5005\/dav\/expresser\/\d{4}-\d{2}-\d{2}\/\d+\.json$/,
    );
  });

  it('uses HTTP PUT method for the metadata file', async () => {
    const draft = makeDraft();
    await publishNas(draft, makeNasStorage());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.method).toBe('PUT');
  });

  it('sends Basic Authorization header', async () => {
    const draft = makeDraft();
    // Use a private LAN URL so the insecure-HTTP guard doesn't reject the request.
    await publishNas(draft, makeNasStorage('http://192.168.1.50/dav', 'user1', 'pass1'));

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers['Authorization']).toMatch(/^Basic /);
    const decoded = Buffer.from(
      (init.headers['Authorization'] as string).slice(6),
      'base64',
    ).toString('utf8');
    expect(decoded).toBe('user1:pass1');
  });

  it('returns null and warns when config is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emptyStorage: AsyncStorageLike = { getItem: () => Promise.resolve(null) };

    const result = await publishNas(makeDraft(), emptyStorage);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NAS config incomplete'));
    warnSpy.mockRestore();
  });

  it('uploads audio blob as second PUT when blobUri is present', async () => {
    const draft = makeDraft();
    await publishNas(draft, makeNasStorage());

    // Should have two PUT calls: .json + .m4a
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [audioUrl, audioInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit & { headers: Record<string, string>; body: unknown },
    ];
    expect(audioUrl).toMatch(/\.m4a$/);
    expect(audioInit.method).toBe('PUT');
    // Body MUST be raw bytes (Uint8Array), NOT the file:// URI string.
    expect(audioInit.body).toBeInstanceOf(Uint8Array);
    expect((audioInit.body as Uint8Array).length).toBeGreaterThan(0);
    expect(audioInit.headers['Content-Type']).toBe('audio/mp4');
  });

  it('throws when NAS URL is plaintext HTTP to a non-private host without override', async () => {
    const draft = makeDraft();
    await expect(
      publishNas(draft, makeNasStorage('http://nas.example.com/dav', 'u', 'p')),
    ).rejects.toThrow(/Refusing to send Basic Auth credentials over plaintext HTTP/);
    // Must not have attempted any network call.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only warns (does not throw) when nas_allow_insecure=true override is set', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const draft = makeDraft();

    // Build a storage that also returns 'true' for the override key.
    state.secureStore['nas_password'] = 'p';
    const overrideStorage: AsyncStorageLike = {
      getItem: (key: string) =>
        Promise.resolve(
          (
            {
              nas_url: 'http://nas.example.com/dav',
              nas_user: 'u',
              nas_allow_insecure: 'true',
            } as Record<string, string>
          )[key] ?? null,
        ),
    };

    const result = await publishNas(draft, overrideStorage);
    expect(result).not.toBeNull();
    expect(
      warnSpy.mock.calls.some((c) =>
        String(c[0]).includes('insecure HTTP allowed by override'),
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does NOT throw when NAS URL is on a private LAN address', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const draft = makeDraft();
    await expect(
      publishNas(draft, makeNasStorage('http://192.168.1.100:5005/dav', 'u', 'p')),
    ).resolves.not.toBeNull();
    expect(
      warnSpy.mock.calls.some((c) =>
        String(c[0]).includes('Refusing to send Basic Auth credentials'),
      ),
    ).toBe(false);
    warnSpy.mockRestore();
  });

  it('does NOT throw when NAS URL is HTTPS', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const draft = makeDraft();
    await expect(
      publishNas(draft, makeNasStorage('https://nas.example.com/dav', 'u', 'p')),
    ).resolves.not.toBeNull();
    expect(
      warnSpy.mock.calls.some((c) =>
        String(c[0]).includes('Refusing to send Basic Auth credentials'),
      ),
    ).toBe(false);
    warnSpy.mockRestore();
  });
});

// ─── livePublish failure propagation ──────────────────────────────────────────

describe('livePublish error propagation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state.createdDirs.length = 0;
    state.writtenFiles.length = 0;
    state.copiedFiles.length = 0;
    Object.keys(state.secureStore).forEach((k) => delete state.secureStore[k]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when every attempted target fails', async () => {
    // Configure NAS so it's actually attempted, then force fetch to reject.
    state.secureStore['nas_password'] = 'p';
    fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    // Make publishLocal blow up too: we simulate by mocking the in-memory
    // mock's File.write to throw via a one-time spy. Easiest is to swap
    // Paths.document to an invalid value temporarily — but our mock is
    // permissive, so instead spy on console and force NAS by injection.
    //
    // We use the public livePublish via the api/index, but since publishNas
    // looks up its own AsyncStorage, the easiest path is to stub it. Set the
    // env: provide nas creds via the global mock storage by stubbing the
    // dynamic import.
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: (k: string) =>
          Promise.resolve(
            ({ nas_url: 'http://192.168.1.100/dav', nas_user: 'u' } as Record<string, string>)[k] ??
              null,
          ),
      },
    }));

    // Also force publishLocal to fail by making create() throw.
    const fs = await import('expo-file-system');
    const origCreate = (fs.Directory.prototype as unknown as { create: () => void }).create;
    (fs.Directory.prototype as unknown as { create: () => void }).create = () => {
      throw new Error('disk full');
    };

    try {
      const { livePublish } = await import('../live');
      await expect(
        livePublish({
          createdAt: Date.now(),
          pieces: [{ id: 'p1', kind: 'voice', t: '00:00', tag: '心情', text: 'x' }],
        }),
      ).rejects.toThrow(/All publish targets failed/);
    } finally {
      (fs.Directory.prototype as unknown as { create: () => void }).create = origCreate;
      vi.doUnmock('@react-native-async-storage/async-storage');
      vi.resetModules();
    }
  });

  it('throws when local fails AND NAS is not configured (regression: attempts/errors counter bug)', async () => {
    // NAS config absent → publishNas returns null (skip), does NOT push to errors.
    // Local archive throws → errors=['local: ...'], succeeded=[], localOk=false.
    // Old logic: attempts=2, errors=1 → errors.length !== attempts → returned []
    //            silently swallowing the local failure.
    // New logic: !localOk && succeeded.length === 0 && errors.length > 0 → throw.
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // No nas_password in SecureStore, no nas_url/nas_user in storage → publishNas skips.
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: () => Promise.resolve(null),
      },
    }));

    const fs = await import('expo-file-system');
    const origCreate = (fs.Directory.prototype as unknown as { create: () => void }).create;
    (fs.Directory.prototype as unknown as { create: () => void }).create = () => {
      throw new Error('disk full');
    };

    try {
      const { livePublish } = await import('../live');
      await expect(
        livePublish({
          createdAt: Date.now(),
          pieces: [{ id: 'p1', kind: 'voice', t: '00:00', tag: '心情', text: 'x' }],
        }),
      ).rejects.toThrow(/All publish targets failed.*local: disk full/);
      // No NAS attempt should have hit fetch.
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      (fs.Directory.prototype as unknown as { create: () => void }).create = origCreate;
      vi.doUnmock('@react-native-async-storage/async-storage');
      vi.resetModules();
    }
  });
});
