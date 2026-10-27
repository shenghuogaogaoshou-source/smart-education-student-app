export type ApiService = 'ai' | 'brain'

export type MobileApiOrigins = {
  aiOrigin: string
  brainOrigin: string
}

const STORAGE_KEY = 'zhiya.mobileApiOrigins'
const NATIVE_MARKER_KEY = 'zhiya.nativeApp'
const DEFAULT_AI_ORIGIN = import.meta.env.VITE_DEFAULT_AI_ORIGIN ?? ''
const DEFAULT_BRAIN_ORIGIN = import.meta.env.VITE_DEFAULT_BRAIN_ORIGIN ?? ''

type CapacitorLike = {
  isNativePlatform?: () => boolean
}

export function isNativeApp() {
  const capacitor = (window as Window & { Capacitor?: CapacitorLike }).Capacitor
  return capacitor?.isNativePlatform?.() === true
}

export function normalizeBackendOrigin(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`)
    return url.origin
  } catch {
    return ''
  }
}

function readStoredOrigins(): Partial<MobileApiOrigins> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<MobileApiOrigins>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readMobileApiOrigins(native = isNativeApp()): MobileApiOrigins {
  const stored = readStoredOrigins()
  return {
    aiOrigin: normalizeBackendOrigin(stored.aiOrigin ?? '') || (native ? normalizeBackendOrigin(DEFAULT_AI_ORIGIN) : ''),
    brainOrigin: normalizeBackendOrigin(stored.brainOrigin ?? '') || (native ? normalizeBackendOrigin(DEFAULT_BRAIN_ORIGIN) : ''),
  }
}

export function saveMobileApiOrigins(aiOrigin: string, brainOrigin: string) {
  const normalized = {
    aiOrigin: normalizeBackendOrigin(aiOrigin),
    brainOrigin: normalizeBackendOrigin(brainOrigin),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function resolveApiUrl(path: string, service: ApiService = 'ai', native = isNativeApp()) {
  if (!native || !path.startsWith('/api/')) return path
  const origins = readMobileApiOrigins(true)
  const origin = service === 'brain' ? origins.brainOrigin : origins.aiOrigin
  return origin ? `${origin}${path}` : path
}

export function apiFetch(input: string, init?: RequestInit, service: ApiService = 'ai') {
  return fetch(resolveApiUrl(input, service), init)
}

export function installMobileApiRuntime() {
  if (!isNativeApp()) return
  localStorage.setItem(NATIVE_MARKER_KEY, '1')
  const stored = readStoredOrigins()
  if (!stored.aiOrigin && !stored.brainOrigin) {
    saveMobileApiOrigins(DEFAULT_AI_ORIGIN, DEFAULT_BRAIN_ORIGIN)
  }
}
