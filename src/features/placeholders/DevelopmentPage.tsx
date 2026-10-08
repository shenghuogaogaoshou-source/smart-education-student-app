import { BookOpenCheck, Construction } from 'lucide-react'

export function DevelopmentPage({ kind }: { kind: 'knowledge' | 'test' }) {
  const isKnowledge = kind === 'knowledge'
  const Icon = isKnowledge ? BookOpenCheck : Construction
  return (
    <section className="development-page">
      <div className="development-mark"><Icon aria-hidden="true" size={30} /></div>
      <p className="section-kicker">{isKnowledge ? '知识板块' : '测试板块'}</p>
      <h1>{isKnowledge ? '知识世界正在准备' : '测试挑战正在准备'}</h1>
      <p>{isKnowledge ? '后续将在这里提供适合当前学段的 AI 通识内容。' : '后续将在这里提供练习、温和反馈与错题整理。'}</p>
      <div className="honest-status">页面初版 · 等待开发中</div>
    </section>
  )
}
