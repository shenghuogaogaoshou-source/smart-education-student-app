import type { CompanionCategory, CompanionLoadout } from '../../app/model'

export type CompanionCatalogItem = {
  id: string
  name: string
  price: number
  asset: string
  gradient: string
  category: CompanionCategory
  description: string
}

export const COMPANION_IDS = ['momo', 'yunduo', 'cloudbloom', 'cloudbelle'] as const
export type CompanionId = (typeof COMPANION_IDS)[number]

export const DEFAULT_COMPANION_ID: CompanionId = 'momo'

export const COMPANION_CATALOG: CompanionCatalogItem[] = [
  { id: 'momo', name: '绒桃 Momo', price: 280, asset: '/pets/momo.png', gradient: 'linear-gradient(145deg, #FFF0E8, #FFD2C6)', category: 'appearance', description: 'AI 伙伴形象' },
  { id: 'yunduo', name: '云朵 Yunduo', price: 360, asset: '/pets/yunduo.png', gradient: 'linear-gradient(145deg, #FFF8ED, #F8DDEA)', category: 'appearance', description: 'AI 伙伴形象' },
  { id: 'cloudbloom', name: '云绽 Cloudbloom', price: 420, asset: '/pets/cloudbloom.png', gradient: 'linear-gradient(145deg, #FFF4E9, #FAD6E5)', category: 'appearance', description: 'AI 伙伴形象' },
  { id: 'cloudbelle', name: '云贝儿 Cloudbelle', price: 480, asset: '/pets/cloudbelle.png', gradient: 'linear-gradient(145deg, #FCEFFF, #E4DCF8)', category: 'appearance', description: 'AI 伙伴形象' },
  { id: 'cloud-backpack', name: '云朵小背包', price: 160, asset: '/mall/elementary/cloud-backpack.png', gradient: 'linear-gradient(145deg, #FFF9EE, #FFE4DC)', category: 'outfit', description: '伙伴服饰' },
  { id: 'dawn-cloud-wand', name: '晨光云杖', price: 220, asset: '/mall/elementary/dawn-cloud-wand.png', gradient: 'linear-gradient(145deg, #FFF9EE, #FFE2C4)', category: 'outfit', description: '伙伴服饰' },
  { id: 'cloud-flower-lamp', name: '云光花灯', price: 180, asset: '/mall/elementary/cloud-flower-lamp.png', gradient: 'linear-gradient(145deg, #FFF8E9, #FFE3CF)', category: 'decoration', description: '学习空间装饰' },
  { id: 'rainbow-cloud-gate', name: '彩虹云门', price: 260, asset: '/mall/elementary/rainbow-cloud-gate.png', gradient: 'linear-gradient(145deg, #FFF5EE, #FFE0E0)', category: 'decoration', description: '学习空间装饰' },
  { id: 'flower-cloud-windchime', name: '花云风铃', price: 200, asset: '/mall/elementary/flower-cloud-windchime.png', gradient: 'linear-gradient(145deg, #FFF8F0, #FFE4D7)', category: 'decoration', description: '学习空间装饰' },
  { id: 'cloud-flower-chair', name: '云朵花椅', price: 300, asset: '/mall/elementary/cloud-flower-chair.png', gradient: 'linear-gradient(145deg, #FFF7ED, #FFDCD0)', category: 'decoration', description: '学习空间装饰' },
]

export function getCompanionItem(id: string | null | undefined) {
  return id ? COMPANION_CATALOG.find((item) => item.id === id) : undefined
}

export function getCompanionDisplayName(id: string | null | undefined) {
  return getCompanionItem(id)?.name ?? getCompanionItem(DEFAULT_COMPANION_ID)!.name
}

export function buildCompanionPreviewLoadout(
  loadout: CompanionLoadout,
  item: CompanionCatalogItem,
): CompanionLoadout {
  return {
    ...loadout,
    equipped: {
      ...loadout.equipped,
      [item.category]: item.id,
    },
  }
}

export function restoreDefaultCompanionLoadout(loadout: CompanionLoadout): CompanionLoadout & {
  equipped: { appearance: CompanionId; outfit: null; decoration: null }
} {
  return {
    ...loadout,
    equipped: {
      appearance: DEFAULT_COMPANION_ID,
      outfit: null,
      decoration: null,
    },
  }
}
