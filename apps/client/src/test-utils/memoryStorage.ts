/**
 * An in-memory Web Storage, for tests that read or write the browser's storage.
 *
 * Node 25 ships a global `localStorage` of its own, and in the jsdom environment
 * it shadows the window's: `localStorage.clear` is then not a function. The
 * tests that touch storage each stubbed their own three methods; this is the
 * whole interface, so a test can `clear()` and count keys like a browser's.
 */
export function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

/** Replace both storages on the global object with fresh, empty ones. */
export function installMemoryStorage(): { local: Storage; session: Storage } {
  const local = memoryStorage();
  const session = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: local,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: session,
    writable: true,
    configurable: true,
  });
  return { local, session };
}
