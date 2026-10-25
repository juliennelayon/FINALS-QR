import Storage from "expo-sqlite/kv-store";

// AsyncStorage-compatible auth storage backed by SQLite (native).
// Used on iOS/Android; the web build uses `./storage.web.ts` instead.
export const authStorage = {
  getItem: (key: string): Promise<string | null> => Storage.getItem(key),
  setItem: (key: string, value: string): Promise<void> =>
    Storage.setItem(key, value),
  removeItem: (key: string): Promise<void> => Storage.removeItem(key),
};
