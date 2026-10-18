/**
 * apiClient.js: the single HTTP client for the CellTriage backend.
 *
 *  - Always sends the signed-in user's Supabase access token as a Bearer token.
 *  - On 401 it refreshes the token once and retries; if that fails the session is
 *    treated as expired and the registered handler signs the user out.
 *  - Failures become ApiError with a `kind` the UI can show a clear message for.
 *  - No mock data and no silent fallbacks, ever.
 */
import { supabase } from './supabaseClient'
import { API_BASE } from './env'

export class ApiError extends Error {
  /**
   * kind: network | timeout | aborted | unauthorized | forbidden | notfound |
   *       unavailable (501/503) | server | client
   */
  constructor(kind, message, { status = null, detail = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.detail = detail
  }
}

let unauthorizedHandler = null
/** AuthContext registers a function that signs out and flags "session expired". */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

async function accessToken(forceRefresh = false) {
  if (!supabase) return null
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession()
    return error ? null : data?.session?.access_token ?? null
  }
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

function detailText(body) {
  const d = body?.detail ?? body?.message ?? body?.error
  if (!d) return null
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join('; ')
  if (typeof d === 'object') return d.message || JSON.stringify(d)
  return String(d)
}

function kindForStatus(status) {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'notfound'
  if (status === 501 || status === 503) return 'unavailable'
  if (status >= 500) return 'server'
  return 'client'
}

async function toApiError(res) {
  let body = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON error body */
  }
  const detail = detailText(body)
  return new ApiError(kindForStatus(res.status), detail || res.statusText || `HTTP ${res.status}`, {
    status: res.status,
    detail,
  })
}

async function send(path, { method = 'GET', body, signal, timeoutMs = 20000 }, token) {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onCallerAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onCallerAbort, { once: true })
  }
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (timedOut) throw new ApiError('timeout', 'The server took too long to respond.')
    if (signal?.aborted) throw new ApiError('aborted', 'Request cancelled.')
    throw new ApiError('network', 'Could not reach the CellTriage server.', { detail: err?.message })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
  }
}

export async function apiRequest(path, opts = {}) {
  let token = await accessToken(false)
  if (!token) {
    unauthorizedHandler?.()
    throw new ApiError('unauthorized', 'You are signed out.', { status: 401 })
  }

  let res = await send(path, opts, token)

  if (res.status === 401) {
    token = await accessToken(true)
    if (token) res = await send(path, opts, token)
    if (!token || res.status === 401) {
      unauthorizedHandler?.()
      throw new ApiError('unauthorized', 'Your session has expired. Please sign in again.', { status: 401 })
    }
  }

  if (!res.ok) throw await toApiError(res)

  try {
    return await res.json()
  } catch {
    throw new ApiError('server', 'The server returned an unreadable response.', { status: res.status })
  }
}

/**
 * Reads every page of a paginated `{ page, page_size, total, records }` endpoint.
 * Returns { records, total }.
 */
export async function fetchAllRecords(path, { pageSize = 500, signal } = {}) {
  const records = []
  let total = Infinity
  for (let page = 1; page <= 200 && records.length < total; page += 1) {
    const sep = path.includes('?') ? '&' : '?'
    const data = await apiRequest(`${path}${sep}page=${page}&page_size=${pageSize}`, { signal })
    if (!Array.isArray(data?.records)) {
      throw new ApiError('server', 'Unexpected response shape (no "records" array).')
    }
    total = Number.isFinite(data.total) ? data.total : data.records.length
    if (data.records.length === 0) break
    records.push(...data.records)
  }
  return { records, total: Number.isFinite(total) ? total : records.length }
}

/** Short, user-facing text for any thrown error. */
export function describeError(err, subject = 'this data') {
  if (!(err instanceof ApiError)) return `Something went wrong loading ${subject}.`
  switch (err.kind) {
    case 'network':
      return 'Cannot reach the CellTriage server. Check your connection and that the backend is running.'
    case 'timeout':
      return 'The server took too long to respond. Please try again.'
    case 'unauthorized':
      return 'Your session has expired. Please sign in again.'
    case 'forbidden':
      return `Your account is not allowed to view ${subject}.`
    case 'notfound':
      return `No ${subject} was found for this vehicle.`
    case 'unavailable':
      return 'This service is not available right now.'
    case 'server':
      return 'The server hit an error. Please try again shortly.'
    default:
      return err.detail || err.message || `Could not load ${subject}.`
  }
}
