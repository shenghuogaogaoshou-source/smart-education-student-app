import { BookCheck, Flame, Timer } from 'lucide-react'

export function LearningOverview() {
  return (
    <section className="profile-section learning-overview" aria-labelledby="learning-overview-title">
      <div className="overview-main">
        <div><p id="learning-overview-title">本周学习</p><strong>4 小时 35 分</strong><span>比上周多探索了 25 分钟</span></div>
        <Timer aria-hidden="true" size={28} />
      </div>
      <div className="overview-pair">
        <div><Flame aria-hidden="true" size={20} /><span>连续学习</span><strong>6 天</strong></div>
        <div><BookCheck aria-hidden="true" size={20} /><span>完成内容</span><strong>12 项</strong></div>
      </div>
    </section>
  )
}
