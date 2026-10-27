import { describe, expect, it } from 'vitest'
import { withGameApiOrigin } from './gameRegistry'

describe('embedded game URLs', () => {
  it('adds the configured mobile API origin without losing the game version', () => {
    const url = withGameApiOrigin(
      'https://localhost/embedded-games/brain-film/?gameVersion=1',
      'http://10.0.0.9:8766',
    )
    const parsed = new URL(url)

    expect(parsed.searchParams.get('gameVersion')).toBe('1')
    expect(parsed.searchParams.get('apiOrigin')).toBe('http://10.0.0.9:8766')
  })
})
