import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getClientCredentials() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined);
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined);

  return { supabaseUrl, supabaseAnonKey };
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const { supabaseUrl, supabaseAnonKey } = getClientCredentials();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = getClientCredentials();
  return Boolean(supabaseUrl && supabaseAnonKey);
}
