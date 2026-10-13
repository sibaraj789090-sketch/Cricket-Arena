import { createClient } from '@supabase/supabase-js';

// Get credentials from environment or user-customized localStorage
const getSavedSupabaseConfig = () => {
  const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : null;
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : null;

  const envUrl = metaEnv?.VITE_SUPABASE_URL || procEnv?.VITE_SUPABASE_URL || '';
  const envKey = metaEnv?.VITE_SUPABASE_ANON_KEY || procEnv?.VITE_SUPABASE_ANON_KEY || '';

  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('cricket_arena_supabase_url') : '';
  const customKey = typeof window !== 'undefined' ? localStorage.getItem('cricket_arena_supabase_anon_key') : '';

  const url = customUrl || envUrl;
  const key = customKey || envKey;

  return {
    url,
    key,
    isConfigured: Boolean(url && key && url.startsWith('http')),
  };
};

export const { url: supabaseUrl, key: supabaseAnonKey, isConfigured: isSupabaseConfigured } = getSavedSupabaseConfig();

// Supabase client instance (mock safe if unconfigured)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function updateSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('cricket_arena_supabase_url', url.trim());
    else localStorage.removeItem('cricket_arena_supabase_url');

    if (key) localStorage.setItem('cricket_arena_supabase_anon_key', key.trim());
    else localStorage.removeItem('cricket_arena_supabase_anon_key');

    window.location.reload();
  }
}
