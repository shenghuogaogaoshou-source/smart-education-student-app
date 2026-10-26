import { ArrowLeft, ChevronDown, Medal, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { GRADE_BAND_LABELS, getGradeBand, type GradeBand, type PrimaryGrade } from '../../app/learning'
import { COURSE_PACKAGES } from '../knowledge/courseCatalog'
import {
  GRADE_BANDS,
  deriveCourseAchievementGroups,
  getAchievementSummary,
  type CourseAchievement,
} from './courseAchievements'
import './profile.css'

type MedalFilter = '全部' | '已获得' | '待解锁'

function matchesFilter(achievement: CourseAchievement, filter: MedalFilter) {
  return filter === '全部'
    || (filter === '已获得' && achievement.earned)
    || (filter === '待解锁' && !achievement.earned)
}

function AchievementCard({ achievement }: { achievement: CourseAchievement }) {
  return (
    <article className={`medal-card ${achievement.earned ? 'earned' : 'locked'}`}>
      <div className="medal-icon" aria-hidden="true">{achievement.icon}</div>
      <strong>{achievement.name}</strong>
      <small>{achievement.description}</small>
      <span className="lock-tag">{achievement.statusText}</span>
    </article>
  )
}

export function MedalsPage({ onBack }: { onBack: () => void }) {
  const { state } = useAppState()
  const currentBand = getGradeBand(state.grade as PrimaryGrade)
  const [filter, setFilter] = useState<MedalFilter>('全部')
  const [expandedBands, setExpandedBands] = useState<Set<GradeBand>>(() => new Set([currentBand]))
  const groups = useMemo(
    () => deriveCourseAchievementGroups(state.learningEvents, state.accountId, state.wrongAnswers),
    [state.accountId, state.learningEvents, state.wrongAnswers],
  )
  const summary = getAchievementSummary(groups)

  function toggleBand(band: GradeBand) {
    setExpandedBands((current) => {
      const next = new Set(current)
      if (next.has(band)) next.delete(band)
      else next.add(band)
      return next
    })
  }

  return (
    <div className="rewards-page medals-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>我的勋章</h1>
      </header>

      <div className="rewards-summary">
        <button
          className={`rewards-stat clickable ${filter === '已获得' ? 'active' : ''}`}
          type="button"
          onClick={() => setFilter(filter === '已获得' ? '全部' : '已获得')}
        >
          <Medal size={24} />
          <div><strong>{summary.earnedCount}</strong><span>已获得</span></div>
        </button>
        <button
          className={`rewards-stat clickable ${filter === '待解锁' ? 'active' : ''}`}
          type="button"
          onClick={() => setFilter(filter === '待解锁' ? '全部' : '待解锁')}
        >
          <Star size={24} />
          <div><strong>{summary.totalCount - summary.earnedCount}</strong><span>待解锁</span></div>
        </button>
      </div>

      <div className="wb-filter-row">
        {(['全部', '已获得', '待解锁'] as MedalFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`wb-filter-chip ${filter === item ? 'active' : ''}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="achievement-groups">
        {GRADE_BANDS.map((band) => {
          const course = COURSE_PACKAGES[band]
          const achievements = groups[band]
          const expanded = expandedBands.has(band)
          const earnedInGroup = achievements.filter((achievement) => achievement.earned).length
          const visible = achievements.filter((achievement) => matchesFilter(achievement, filter))
          const partGroups = course.parts.map((part) => (
            visible.filter((achievement) => achievement.partId === part.id)
          ))
          const finale = visible.find((achievement) => achievement.kind === 'finale')

          return (
            <section
              key={band}
              id={`achievement-group-${band}`}
              className={`achievement-group ${band === currentBand ? 'current' : ''}`}
              aria-label={`${course.name}勋章`}
            >
              <button
                type="button"
                className="achievement-group-header"
                aria-expanded={expanded}
                aria-controls={`achievement-group-content-${band}`}
                aria-label={`${GRADE_BAND_LABELS[band]} ${course.name}，获得 ${earnedInGroup} / ${achievements.length} 枚`}
                onClick={() => toggleBand(band)}
              >
                <span>
                  <small>{GRADE_BAND_LABELS[band]}</small>
                  <strong>{course.name}</strong>
                </span>
                <b>{earnedInGroup} / {achievements.length}</b>
                <ChevronDown aria-hidden="true" size={18} />
              </button>

              {expanded && (
                <div id={`achievement-group-content-${band}`} className="achievement-group-content">
                  <ul className="achievement-pair-list">
                    {partGroups.map((pair, index) => (
                      pair.length > 0 && (
                        <li key={course.parts[index].id} className="achievement-pair">
                          {pair.map((achievement) => (
                            <AchievementCard key={achievement.id} achievement={achievement} />
                          ))}
                        </li>
                      )
                    ))}
                  </ul>
                  {finale && (
                    <div className="medal-grid achievement-finale">
                      <AchievementCard achievement={finale} />
                    </div>
                  )}
                  {visible.length === 0 && (
                    <p className="achievement-empty">这个筛选下暂时没有勋章。</p>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
