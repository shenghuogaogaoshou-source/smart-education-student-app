export type ApiService = 'ai' | 'brain'

export type MobileApiConfig = {
  apiOrigin: string
}

const LEGACY_STORAGE_KEY = 'zhiya.mobileApiOrigins'
const STORAGE_KEY = 'zhiya.mobileApiOrigin'
const NATIVE_MARKER_KEY = 'zhiya.nativeApp'
const PRODUCTION_API_ORIGIN = import.meta.env.VITE_PRODUCTION_API_ORIGIN ?? ''

type CapacitorLike = {
  isNativePlatform?: () => boolean
}

export function isNativeApp() {
  const capacitor = (window as Window & { Capacitor?: CapacitorLike }).Capacitor
  return capacitor?.isNativePlatform?.() === true
}

export function isProductionNativeRelease() {
  return import.meta.env.VITE_NATIVE_RELEASE === '1'
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

export function normalizeProductionApiOrigin(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Production API origin is required')
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Production API origin is invalid')
  }
  if (url.protocol !== 'https:') throw new Error('Production API origin must use HTTPS')
  if (url.username || url.password) throw new Error('Production API origin must not contain credentials')
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Production API origin must not contain a path, query or fragment')
  }
  return url.origin
}

function migrateLegacyOrigin() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return ''
    const legacy = JSON.parse(raw) as { aiOrigin?: unknown }
    const origin = typeof legacy.aiOrigin === 'string' ? normalizeBackendOrigin(legacy.aiOrigin) : ''
    if (origin) localStorage.setItem(STORAGE_KEY, origin)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return origin
  } catch {
    return ''
  }
}

function readStoredApiOrigin() {
  try {
    const current = normalizeBackendOrigin(localStorage.getItem(STORAGE_KEY) ?? '')
    return current || migrateLegacyOrigin()
  } catch {
    return ''
  }
}

export function readMobileApiConfig(productionNative = isProductionNativeRelease()): MobileApiConfig {
  if (productionNative) {
    return { apiOrigin: normalizeProductionApiOrigin(PRODUCTION_API_ORIGIN) }
  }
  return { apiOrigin: readStoredApiOrigin() }
}

export function saveMobileApiOrigin(apiOrigin: string) {
  const normalized = normalizeBackendOrigin(apiOrigin)
  if (normalized) localStorage.setItem(STORAGE_KEY, normalized)
  return normalized
}

export function resolveApiUrl(path: string, service: ApiService = 'ai', native = isNativeApp()) {
  if (!native || !path.startsWith('/api/')) return path
  const { apiOrigin } = readMobileApiConfig()
  if (!apiOrigin) return path
  return service === 'brain' ? `${apiOrigin}/brain${path}` : `${apiOrigin}${path}`
}

export function readNativeTaskApiOrigin(native = isNativeApp()) {
  if (!native) return ''
  return readMobileApiConfig().apiOrigin
}

export function apiFetch(input: string, init?: RequestInit, service: ApiService = 'ai') {
  return fetch(resolveApiUrl(input, service), init)
}

export function installMobileApiRuntime() {
  if (!isNativeApp()) return
  localStorage.setItem(NATIVE_MARKER_KEY, '1')
  if (!isProductionNativeRelease()) readMobileApiConfig(false)
}
