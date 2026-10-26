import {
  createDefaultState,
  type AppState,
  type CompanionLoadout,
  type ConversationSummary,
} from './model'
import { LEGACY_STORAGE_KEY, normalizePersistedState, toPersistedState } from './storage'

const DEFAULT_DEMO_ACCOUNT = 'chenxi_2026'
const ACCOUNT_STORAGE_PREFIX = 'zhizya:demo-account:'

export function normalizeAccountId(accountId: string): string {
  return accountId.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN') || 'guest'
}

export function accountStorageKey(accountId: string): string {
  return `${ACCOUNT_STORAGE_PREFIX}${normalizeAccountId(accountId)}`
}

function createAccountDefault(accountId: string): AppState {
  return { ...createDefaultState(), accountId: normalizeAccountId(accountId) }
}

function parseAccountState(raw: string | null, fallback: AppState): AppState {
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? normalizePersistedState(parsed, fallback) : fallback
  } catch {
    return fallback
  }
}

export function loadAccountState(accountId: string): AppState {
  const normalizedAccountId = normalizeAccountId(accountId)
  const key = accountStorageKey(normalizedAccountId)
  const fallback = createAccountDefault(normalizedAccountId)
  const stored = localStorage.getItem(key)

  if (stored !== null) {
    const state = { ...parseAccountState(stored, fallback), accountId: normalizedAccountId }
    saveAccountState(normalizedAccountId, state)
    return state
  }

  if (normalizedAccountId === DEFAULT_DEMO_ACCOUNT) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy !== null) {
      const migrated = { ...parseAccountState(legacy, fallback), accountId: normalizedAccountId }
      saveAccountState(normalizedAccountId, migrated)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return migrated
    }
  }

  const normalizedFallback = normalizePersistedState(toPersistedState(fallback), fallback)
  saveAccountState(normalizedAccountId, normalizedFallback)
  return normalizedFallback
}

export function saveAccountState(accountId: string, state: AppState): void {
  const normalizedAccountId = normalizeAccountId(accountId)
  const fallback = createAccountDefault(normalizedAccountId)
  const normalized = normalizePersistedState(
    toPersistedState({ ...state, accountId: normalizedAccountId }),
    fallback,
  )
  localStorage.setItem(accountStorageKey(normalizedAccountId), JSON.stringify(toPersistedState(normalized)))
}

export function peekAccountCompanion(accountId: string): CompanionLoadout {
  const normalizedAccountId = normalizeAccountId(accountId)
  const fallback = createAccountDefault(normalizedAccountId)
  const accountRaw = localStorage.getItem(accountStorageKey(normalizedAccountId))
  const legacyRaw = normalizedAccountId === DEFAULT_DEMO_ACCOUNT
    ? localStorage.getItem(LEGACY_STORAGE_KEY)
    : null
  const { companion } = parseAccountState(accountRaw ?? legacyRaw, fallback)
  return {
    ...companion,
    owned: {
      appearance: [...companion.owned.appearance],
      outfit: [...companion.owned.outfit],
      decoration: [...companion.owned.decoration],
    },
    equipped: { ...companion.equipped },
  }
}

export function appendConversationSummary(accountId: string, summary: ConversationSummary): void {
  const state = loadAccountState(accountId)
  const conversationSummaries = [
    ...state.conversationSummaries.filter((entry) => entry.id !== summary.id),
    { ...summary },
  ].slice(-20)
  saveAccountState(accountId, { ...state, conversationSummaries })
}

export function clearAccountState(accountId: string): void {
  localStorage.removeItem(accountStorageKey(accountId))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
