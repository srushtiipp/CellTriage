import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY, isSupabaseConfigured } from './env'

/**
 * `supabase` is null when credentials are missing. The app shows a configuration
 * message instead of silently talking to a placeholder project.
 */
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

export { isSupabaseConfigured }
