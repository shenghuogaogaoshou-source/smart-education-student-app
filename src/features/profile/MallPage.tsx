import { ArrowLeft, ShoppingBag, Shirt, Sparkles } from 'lucide-react'
import { useState } from 'react'
import './profile.css'

type MallItem = {
  id: string
  name: string
  category: '形象' | '服饰' | '装饰'
  price: number
  owned: boolean
  gradient: string
}

const items: MallItem[] = [
  { id: 'i1', name: '星空精灵', category: '形象', price: 500, owned: true, gradient: 'linear-gradient(135deg, #6E9DC8, #CFBDE8)' },
  { id: 'i2', name: '阳光小熊', category: '形象', price: 450, owned: false, gradient: 'linear-gradient(135deg, #F5C7A5, #FFD97D)' },
  { id: 'i3', name: '森林伙伴', category: '形象', price: 600, owned: false, gradient: 'linear-gradient(135deg, #8BC4A8, #A5CE6B)' },
  { id: 'i4', name: '星空披风', category: '服饰', price: 120, owned: true, gradient: 'linear-gradient(135deg, #5B6FA0, #8FA0D0)' },
  { id: 'i5', name: '彩虹翅膀', category: '服饰', price: 180, owned: false, gradient: 'linear-gradient(135deg, #F5B5C8, #CFBDE8)' },
  { id: 'i6', name: '小小科学家帽', category: '服饰', price: 150, owned: false, gradient: 'linear-gradient(135deg, #A8C8E4, #F5C7A5)' },
  { id: 'i7', name: '知识灯泡', category: '装饰', price: 80, owned: false, gradient: 'linear-gradient(135deg, #FFD97D, #F5C7A5)' },
  { id: 'i8', name: '星光边框', category: '装饰', price: 100, owned: false, gradient: 'linear-gradient(135deg, #CFBDE8, #6E9DC8)' },
]

const CATEGORIES: ('全部' | MallItem['category'])[] = ['全部', '形象', '服饰', '装饰']

export function MallPage({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('全部')
  const [owned, setOwned] = useState<string[]>(['i1', 'i4'])
  const [toast, setToast] = useState('')
  const balance = 1280

  const filtered = category === '全部' ? items : items.filter((i) => i.category === category)

  const buy = (item: MallItem) => {
    if (owned.includes(item.id)) return
    if (balance < item.price) {
      setToast('积分不够哦，继续学习攒积分吧！')
      window.setTimeout(() => setToast(''), 2000)
      return
    }
    setOwned([...owned, item.id])
    setToast(`已解锁「${item.name}」！`)
    window.setTimeout(() => setToast(''), 2000)
  }

  return (
    <div className="rewards-page mall-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>积分商城</h1>
      </header>

      <div className="mall-balance">
        <Sparkles aria-hidden="true" size={18} />
        <span>当前积分 <strong>1,280</strong></span>
        <ShoppingBag aria-hidden="true" size={18} />
      </div>

      <div className="mall-categories" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={category === c ? 'active' : ''}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mall-grid">
        {filtered.map((item) => {
          const isOwned = owned.includes(item.id)
          return (
            <div key={item.id} className={`mall-item ${isOwned ? 'owned' : ''}`}>
              <div className="mall-item-icon" style={{ background: item.gradient }}>
                <Shirt size={26} />
              </div>
              <strong>{item.name}</strong>
              <small>{item.category}</small>
              {isOwned ? (
                <span className="mall-owned-tag">已拥有</span>
              ) : (
                <button type="button" onClick={() => buy(item)}>
                  <Sparkles size={12} />
                  {item.price}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {toast && <p className="mall-toast" role="status">{toast}</p>}
    </div>
  )
}
