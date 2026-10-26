import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react'
import { DEMO_ACCOUNT_ID, normalizeAccountId } from '../../app/companionAccountRepository'

export { DEMO_ACCOUNT_ID }

export function verifyDemoCredential(accountId: string, password: string): boolean {
  return normalizeAccountId(accountId) === DEMO_ACCOUNT_ID && password === '123'
}

type SessionCredential = {
  accountId: string
  password: string
} | null

type SessionCredentialContextValue = {
  establish: (accountId: string, password: string) => void
  verify: (password: string) => boolean
  clear: () => void
}

const SessionCredentialContext = createContext<SessionCredentialContextValue | null>(null)

export function SessionCredentialProvider({ children }: PropsWithChildren) {
  const credentialRef = useRef<SessionCredential>(null)

  const establish = useCallback((accountId: string, password: string) => {
    credentialRef.current = {
      accountId: normalizeAccountId(accountId),
      password,
    }
  }, [])

  const verify = useCallback((password: string) => (
    credentialRef.current !== null && credentialRef.current.password === password
  ), [])

  const clear = useCallback(() => {
    credentialRef.current = null
  }, [])

  const value = useMemo(() => ({ establish, verify, clear }), [clear, establish, verify])

  return (
    <SessionCredentialContext.Provider value={value}>
      {children}
    </SessionCredentialContext.Provider>
  )
}

export function useSessionCredential() {
  const value = useContext(SessionCredentialContext)
  if (!value) throw new Error('useSessionCredential must be used inside SessionCredentialProvider')
  return value
}

export function useOptionalSessionCredential() {
  return useContext(SessionCredentialContext)
}
