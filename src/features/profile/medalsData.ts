import { Crown, Eye, Medal, Rocket, Sparkles, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface MedalInfo {
  id: string
  name: string
  desc: string
  earned: boolean
  icon: LucideIcon
  color: string
}

// 勋章图片：/public/medals/<学段>/<id>.png
// 图片缺失时自动回退到下面的 lucide 图标。
export const medals: MedalInfo[] = [
  { id: 'm1', name: '初露锋芒', desc: '完成第一节 AI 课程', earned: true, icon: Star, color: '#A8C8E4' },
  { id: 'm2', name: '观察家', desc: '连续学习 7 天', earned: true, icon: Eye, color: '#CFBDE8' },
  { id: 'm3', name: '创意探索者', desc: '完成 3 个创意作品', earned: true, icon: Sparkles, color: '#F5B5C8' },
  { id: 'm4', name: '实践工匠', desc: '完成 10 个作品挑战', earned: true, icon: Rocket, color: '#F5C7A5' },
  { id: 'm5', name: '团队明星', desc: '作品被 5 位同学收藏', earned: true, icon: Crown, color: '#FFD97D' },
  { id: 'm6', name: '学习达人', desc: '累计学习时长 30 小时', earned: true, icon: Medal, color: '#8BC4A8' },
  { id: 'm7', name: '知识先锋', desc: '连续 3 周保持学习', earned: false, icon: Medal, color: '#D0D0D0' },
  { id: 'm8', name: 'AI 大师', desc: '完成全部 AI 通识课程', earned: false, icon: Crown, color: '#D0D0D0' },
]
