// AsyncStorage-compatible auth storage backed by browser localStorage (web).
// Keeping this separate means `expo-sqlite` (and its wa-sqlite WASM asset)
// is only bundled for native builds.

const store: Storage | null =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : null;

export const authStorage = {
  getItem: (key: string): Promise<string | null> =>
    Promise.resolve(store?.getItem(key) ?? null),
  setItem: (key: string, value: string): Promise<void> => {
    store?.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    store?.removeItem(key);
    return Promise.resolve();
  },
};
