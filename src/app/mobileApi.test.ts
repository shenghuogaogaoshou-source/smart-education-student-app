import { beforeEach, describe, expect, it } from 'vitest'
import {
  normalizeBackendOrigin,
  readMobileApiOrigins,
  resolveApiUrl,
  saveMobileApiOrigins,
} from './mobileApi'

describe('mobile API configuration', () => {
  beforeEach(() => localStorage.clear())

  it('normalizes a LAN host with an explicit service port', () => {
    expect(normalizeBackendOrigin('192.168.1.20:8787')).toBe('http://192.168.1.20:8787')
    expect(normalizeBackendOrigin(' https://school.example/api/ ')).toBe('https://school.example')
  })

  it('stores independent AI and brain-film origins', () => {
    saveMobileApiOrigins('http://10.0.0.2:8787', 'http://10.0.0.2:8766')
    expect(readMobileApiOrigins(true)).toEqual({
      aiOrigin: 'http://10.0.0.2:8787',
      brainOrigin: 'http://10.0.0.2:8766',
    })
  })

  it('keeps browser relative API calls working', () => {
    expect(resolveApiUrl('/api/companion/reply', 'ai', false)).toBe('/api/companion/reply')
  })

  it('routes native WebView API calls to the configured LAN backend', () => {
    saveMobileApiOrigins('http://10.0.0.2:8787', 'http://10.0.0.2:8766')
    expect(resolveApiUrl('/api/companion/reply', 'ai', true))
      .toBe('http://10.0.0.2:8787/api/companion/reply')
    expect(resolveApiUrl('/api/health', 'brain', true))
      .toBe('http://10.0.0.2:8766/api/health')
  })
})
