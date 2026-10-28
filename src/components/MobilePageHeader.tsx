import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import './mobile-layout.css'

export function MobilePageHeader({
  title,
  eyebrow,
  onBack,
  action,
  className = '',
}: {
  title: string
  eyebrow?: string
  onBack: () => void
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={`mobile-page-header ${className}`.trim()}>
      <button className="mobile-page-header__back" type="button" onClick={onBack} aria-label="返回">
        <ArrowLeft aria-hidden="true" size={20} />
      </button>
      <div className="mobile-page-header__copy">
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      <div className="mobile-page-header__action">{action}</div>
    </header>
  )
}
