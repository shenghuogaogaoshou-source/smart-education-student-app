import { Medal, Shirt, ShoppingBag, Sparkles, Trophy } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { getPointsSummary } from '../../app/points'
import { deriveCourseAchievementGroups, getAchievementSummary } from './courseAchievements'

export function RewardsSection({ onOpenMedals, onOpenPoints, onOpenMall, onOpenRanking }: {
  onOpenMedals?: () => void
  onOpenPoints?: () => void
  onOpenMall?: () => void
  onOpenRanking?: () => void
}) {
  const { state } = useAppState()
  const { earnedCount: earnedMedalCount, totalCount: totalMedalCount } = getAchievementSummary(
    deriveCourseAchievementGroups(state.learningEvents, state.accountId, state.wrongAnswers),
  )
  const pointsSummary = getPointsSummary(state.transactions)

  return (
    <section className="profile-section rewards-section" aria-labelledby="rewards-title">
      <div className="section-heading-row"><div><p className="section-kicker">成长收藏</p><h2 id="rewards-title">勋章与积分</h2></div><button className="text-action" type="button" onClick={onOpenMedals}>全部勋章</button></div>
      <div className="reward-pair">
        <button type="button" onClick={onOpenMedals}><Medal aria-hidden="true" /><span>我的勋章</span><strong>{earnedMedalCount} / {totalMedalCount} 枚</strong><small>看看获得记录</small></button>
        <button type="button" onClick={onOpenPoints}><Sparkles aria-hidden="true" /><span>积分账户</span><strong>{pointsSummary.balance.toLocaleString('zh-CN')}</strong><small>收支明细</small></button>
      </div>
      <button className="mall-card" type="button" onClick={onOpenMall}><span className="mall-icon"><ShoppingBag aria-hidden="true" /></span><span><strong>积分商城</strong><small>升级 AI 形象与购买服饰装饰</small></span><Shirt aria-hidden="true" /></button>
      <button className="ranking-strip" type="button" onClick={onOpenRanking}><Trophy aria-hidden="true" size={18} /><span><strong>积分排行榜</strong><small>看看本周的共同成长</small></span><b>第 18 名</b></button>
    </section>
  )
}
