/**
 * AuthContext: Supabase email/password session + backend identity.
 *
 * Supabase proves WHO the user is. The backend (GET /api/auth/me) is the single
 * source of truth for WHAT they may do: role and assigned vehicles. The frontend
 * never reads the `profiles` table directly and never trusts a role chosen in the UI.
 *
 * status:
 *   unconfigured | loading | signedOut | ready | error
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { setUnauthorizedHandler } from '../lib/apiClient'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still restoring the stored session
  const [session, setSession] = useState(supabase ? undefined : null)
  const [profile, setProfile] = useState(null)
  const [profileState, setProfileState] = useState('idle') // idle | loading | ready | error
  const [profileError, setProfileError] = useState(null)
  const [notice, setNotice] = useState(null) // 'expired' | null
  const [retryTick, setRetryTick] = useState(0)
  const signingOutRef = useRef(false)

  const userId = session?.user?.id ?? null

  // 1. Restore and follow the Supabase session.
  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session ?? null)
      })
      .catch(() => {
        if (active) setSession(null)
      })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      // Keep this callback synchronous: no other Supabase calls inside it.
      setSession(next ?? null)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // 2. Ask the backend who this user is.
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileState('idle')
      setProfileError(null)
      return undefined
    }
    const controller = new AbortController()
    setProfileState('loading')
    setProfileError(null)
    getMe(controller.signal)
      .then((me) => {
        setProfile({
          userId: me.user_id,
          role: me.role,
          fullName: me.full_name || null,
          vehicleIds: Array.isArray(me.assigned_vehicle_ids) ? me.assigned_vehicle_ids.map(String) : [],
        })
        setProfileState('ready')
      })
      .catch((err) => {
        if (err?.kind === 'aborted') return
        if (err?.kind === 'unauthorized') return // the unauthorized handler signs the user out
        setProfile(null)
        setProfileError(err)
        setProfileState('error')
      })
    return () => controller.abort()
  }, [userId, retryTick])

  // 3. An expired session (401 after a refresh attempt) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (signingOutRef.current) return // an intentional logout is not an "expiry"
      setNotice('expired')
      supabase?.auth.signOut({ scope: 'local' }).catch(() => {})
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: new Error('Supabase is not configured.') }
    signingOutRef.current = false
    setNotice(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    signingOutRef.current = true
    setNotice(null)
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut()
        // If the server could not be reached the session would otherwise survive.
        if (error) await supabase.auth.signOut({ scope: 'local' })
      } catch {
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          /* nothing more we can do */
        }
      }
    }
    setSession(null)
    setProfile(null)
    setProfileState('idle')
  }, [])

  const retryProfile = useCallback(() => setRetryTick((n) => n + 1), [])
  const clearNotice = useCallback(() => setNotice(null), [])

  let status
  if (!isSupabaseConfigured) status = 'unconfigured'
  else if (session === undefined) status = 'loading'
  else if (!session) status = 'signedOut'
  else if (profileState === 'ready') status = 'ready'
  else if (profileState === 'error') status = 'error'
  else status = 'loading'

  const value = useMemo(
    () => ({
      status,
      session,
      email: session?.user?.email ?? null,
      profile,
      role: profile?.role ?? null,
      fullName: profile?.fullName ?? null,
      vehicleIds: profile?.vehicleIds ?? [],
      profileError,
      notice,
      signIn,
      signOut,
      retryProfile,
      clearNotice,
    }),
    [status, session, profile, profileError, notice, signIn, signOut, retryProfile, clearNotice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
