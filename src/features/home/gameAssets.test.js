import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { games } from './homeData'

describe('creative game assets', () => {
  it('六个游戏入口都使用新资源名', () => {
    const names = [...games.map((game) => game.icon), 'all']
    expect(names).toEqual(['brain-film', 'creative-module', 'sort', 'bot', 'create', 'all'])
    names.forEach((name) => {
      expect(existsSync(resolve('public/games/elementary', `${name}.png`))).toBe(true)
    })
  })
})
