/**
 * env.js: the only place that reads import.meta.env.
 */
const env = import.meta.env

export const SUPABASE_URL = (env.VITE_SUPABASE_URL || '').trim()
export const SUPABASE_KEY = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()

/** Empty string means "same origin" (the Vite dev proxy forwards /api to the backend). */
export const API_BASE = (env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL && SUPABASE_KEY) &&
  !/your-project|placeholder|your-publishable/i.test(`${SUPABASE_URL} ${SUPABASE_KEY}`)

// A service_role key must never reach the browser bundle.
if (env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[CellTriage] A Supabase service_role key is present in the frontend environment. Remove it.')
}
