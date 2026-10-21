export type GameId = 'brain-film' | 'creative-module'

type GameConfig = {
  title: string
  devUrl: string
  productionUrl: string
  url: string
  allowedOrigin: string
}

const registry = {
  'brain-film': {
    title: '脑洞放映厅',
    devUrl: 'http://127.0.0.1:5191',
    productionUrl: '/embedded-games/brain-film/',
  },
  'creative-module': {
    title: '创造模块',
    devUrl: 'http://127.0.0.1:5192',
    productionUrl: '/embedded-games/creative-module/',
  },
} as const

export function getGameConfig(id: GameId): GameConfig {
  const config = registry[id]
  const url = import.meta.env.PROD ? config.productionUrl : config.devUrl
  return {
    ...config,
    url,
    allowedOrigin: new URL(url, window.location.origin).origin,
  }
}
