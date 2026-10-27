/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRODUCTION_API_ORIGIN?: string
  readonly VITE_NATIVE_RELEASE?: '0' | '1'
}
