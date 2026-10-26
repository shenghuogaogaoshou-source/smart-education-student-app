import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { BRAND } from './brand'

describe('brand metadata', () => {
  it('defines the single approved 智芽 brand source', () => {
    expect(BRAND).toEqual({
      name: '智芽',
      positioning: '小学生 AI 学习成长伙伴',
      version: '学生端 v1.1.0',
      browserTitle: '智芽｜小学生 AI 学习成长伙伴',
      copyright: '© 2026 智芽 · 陪孩子安全、好奇地学习 AI',
      logoSrc: '/brand/zhinya-mark.png',
      logoAlt: '智芽品牌标志',
    })
  })

  it('uses the brand browser title in the static HTML shell', () => {
    expect(indexHtml).toContain(`<title>${BRAND.browserTitle}</title>`)
  })
})
