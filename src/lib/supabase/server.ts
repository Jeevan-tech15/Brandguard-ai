import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getServerSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const effectiveKey = rawServiceRoleKey || rawAnonKey;

  return {
    supabaseUrl,
    rawServiceRoleKey,
    rawAnonKey,
    effectiveKey,
  };
}

export function getSupabaseServerClient(): SupabaseClient | null {
  const { supabaseUrl, effectiveKey } = getServerSupabaseConfig();
  if (!supabaseUrl || !effectiveKey) {
    return null;
  }

  return createClient(supabaseUrl, effectiveKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getServerDbConfigStatus(): {
  isConfigured: boolean;
  hasUrl: boolean;
  hasServiceKey: boolean;
  hasAnonKey: boolean;
  missingVars: string[];
} {
  const { supabaseUrl, rawServiceRoleKey, rawAnonKey } = getServerSupabaseConfig();
  const hasUrl = Boolean(supabaseUrl);
  const hasServiceKey = Boolean(rawServiceRoleKey);
  const hasAnonKey = Boolean(rawAnonKey);
  const missingVars: string[] = [];

  if (!hasUrl) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!hasServiceKey && !hasAnonKey) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return {
    isConfigured: hasUrl && (hasServiceKey || hasAnonKey),
    hasUrl,
    hasServiceKey,
    hasAnonKey,
    missingVars,
  };
}
