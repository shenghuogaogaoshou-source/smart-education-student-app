import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true })
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { value: () => undefined, writable: true })

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-font-scale')
})
