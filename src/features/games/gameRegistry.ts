export type GameId = 'brain-film' | 'creative-module'
export const LAST_PLAYED_GAME_KEY = 'zhiya:last-played-game'

type GameConfig = {
  title: string
  devUrl: string
  productionUrl: string
  url: string
  allowedOrigin: string
}

const GAME_BUNDLE_VERSION = '20261027-1'
const DEFAULT_GAME_ID: GameId = 'brain-film'

const registry = {
  'brain-film': {
    title: '脑洞放映厅',
    devUrl: 'http://127.0.0.1:5191',
    productionUrl: '/embedded-games/brain-film/index.html',
  },
  'creative-module': {
    title: '创造模块',
    devUrl: 'http://127.0.0.1:5192',
    productionUrl: '/embedded-games/creative-module/index.html',
  },
} as const

export function getGameConfig(id: GameId): GameConfig {
  const config = registry[id]
  const baseUrl = import.meta.env.PROD ? config.productionUrl : config.devUrl
  const normalizedBaseUrl = baseUrl.endsWith('/') || /\.html$/i.test(baseUrl) ? baseUrl : `${baseUrl}/`
  const url = `${normalizedBaseUrl}?gameVersion=${GAME_BUNDLE_VERSION}`
  return {
    ...config,
    url,
    allowedOrigin: new URL(url, window.location.origin).origin,
  }
}

export function withGameApiOrigin(url: string, origin?: string) {
  if (!origin) return url
  try {
    const gameUrl = new URL(url, window.location.origin)
    gameUrl.searchParams.set('apiOrigin', origin)
    return gameUrl.href
  } catch {
    return url
  }
}

export function rememberLastPlayedGame(gameId: GameId) {
  try {
    localStorage.setItem(LAST_PLAYED_GAME_KEY, gameId)
  } catch {
    // Opening the game still works when storage is unavailable.
  }
}

export function getLastPlayedGame(): GameId {
  try {
    const stored = localStorage.getItem(LAST_PLAYED_GAME_KEY)
    return stored === 'creative-module' || stored === 'brain-film' ? stored : DEFAULT_GAME_ID
  } catch {
    return DEFAULT_GAME_ID
  }
}
