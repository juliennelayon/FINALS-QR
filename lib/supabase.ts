import { createClient } from "@supabase/supabase-js";

// Platform-specific storage: `expo-sqlite/kv-store` on native, localStorage
// on web (see lib/storage.ts / lib/storage.web.ts). Splitting keeps the
// wa-sqlite WASM asset out of the web bundle.
import { authStorage } from "./storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
