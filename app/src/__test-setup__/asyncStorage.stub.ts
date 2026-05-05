/**
 * In-memory stub for @react-native-async-storage/async-storage.
 * The real package requires React Native native bindings; this module alias
 * (configured in vitest.config.ts) lets Zustand's `persist` middleware
 * initialise without errors in the Node test environment.
 */
const store: Record<string, string> = {};

const AsyncStorage = {
  getItem: (key: string): Promise<string | null> => Promise.resolve(store[key] ?? null),
  setItem: (key: string, value: string): Promise<void> => {
    store[key] = value;
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    delete store[key];
    return Promise.resolve();
  },
  clear: (): Promise<void> => {
    Object.keys(store).forEach((k) => delete store[k]);
    return Promise.resolve();
  },
  getAllKeys: (): Promise<string[]> => Promise.resolve(Object.keys(store)),
  multiGet: (keys: string[]): Promise<[string, string | null][]> =>
    Promise.resolve(keys.map((k) => [k, store[k] ?? null])),
  multiSet: (pairs: [string, string][]): Promise<void> => {
    pairs.forEach(([k, v]) => {
      store[k] = v;
    });
    return Promise.resolve();
  },
  multiRemove: (keys: string[]): Promise<void> => {
    keys.forEach((k) => delete store[k]);
    return Promise.resolve();
  },
};

// Named export used by some async-storage consumers
export function createAsyncStorage(_name?: string) {
  return AsyncStorage;
}

export { AsyncStorage as AsyncStorageError };

export default AsyncStorage;
