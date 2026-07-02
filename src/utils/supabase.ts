import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * True when real Supabase credentials are present. Without them the client
 * below points at a placeholder project: auth calls will fail at request
 * time, but the module can be imported (and the app statically exported)
 * without crashing — required for CI builds that have no secrets.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * Platform-aware storage adapter.
 *
 * On React Native (iOS / Android) we use AsyncStorage.
 * On web we use localStorage, but guard against the SSR/Node.js phase where
 * `window` is not defined. Expo's static renderer injects a partial
 * `localStorage` stub (via --localstorage-file) that lacks real methods, so
 * `typeof localStorage` alone is not a reliable SSR check — `typeof window`
 * is the correct boundary.
 */
const webStorage = {
  getItem: (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
    return Promise.resolve();
  },
};

const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder-key',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);