import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests require a real Supabase project (a test project or local
 * `supabase start`). When the env is missing or clearly a placeholder, the
 * suites skip themselves cleanly so `pnpm verify` stays green without infra.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(
  url &&
    serviceKey &&
    anonKey &&
    !url.includes("placeholder") &&
    !serviceKey.includes("placeholder"),
);

export function adminClient(): SupabaseClient {
  return createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** A fresh anon client (RLS applies once a user session is set). */
export function anonClient(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}
