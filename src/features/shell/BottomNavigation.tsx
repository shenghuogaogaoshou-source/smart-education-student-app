import { BookOpen, ClipboardCheck, House, UserRound } from 'lucide-react'

export type MainTab = 'home' | 'knowledge' | 'test' | 'profile'

const items: Array<{ id: MainTab; label: string; Icon: typeof House }> = [
  { id: 'home', label: '首页', Icon: House },
  { id: 'knowledge', label: '知识', Icon: BookOpen },
  { id: 'test', label: '测试', Icon: ClipboardCheck },
  { id: 'profile', label: '我的', Icon: UserRound },
]

export function BottomNavigation({ activeTab, onSelect }: { activeTab: MainTab; onSelect: (tab: MainTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="主要导航">
      {items.map(({ id, label, Icon }) => (
        <button key={id} type="button" aria-label={label} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onSelect(id)}>
          <Icon aria-hidden="true" size={21} strokeWidth={activeTab === id ? 2.5 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
