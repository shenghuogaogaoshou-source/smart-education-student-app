import type { CoursePartId, GradeBand } from '../../app/learning'
import type { LearningEvent } from '../../app/learningEvents'
import type { WrongAnswerRecord } from '../../app/model'
import { COURSE_PACKAGES } from '../knowledge/courseCatalog'

export const GRADE_BANDS: GradeBand[] = ['grade1-2', 'grade3-4', 'grade5-6']

export type CourseAchievementKind = 'knowledge' | 'challenge' | 'finale'

export type CourseAchievement = {
  id: string
  band: GradeBand
  kind: CourseAchievementKind
  partId?: CoursePartId
  name: string
  icon: string
  description: string
  earned: boolean
  earnedAt: string | null
  statusText: string
}

export type CourseAchievementGroups = Record<GradeBand, CourseAchievement[]>

function earnedDate(occurredAt: string): string {
  return `已获得 · ${occurredAt.slice(0, 10)}`
}

function latestDate(events: LearningEvent[]): string {
  return events.reduce((latest, event) => event.occurredAt > latest ? event.occurredAt : latest, '')
}

export function deriveCourseAchievementGroups(
  events: LearningEvent[],
  accountId: string,
  wrongAnswers: WrongAnswerRecord[] = [],
): CourseAchievementGroups {
  const accountEvents = events.filter((event) => event.accountId === accountId)
  const unresolvedPartIds = new Set(
    wrongAnswers
      .filter((answer) => !answer.correctedAt)
      .map((answer) => answer.partId),
  )
  const groups = {} as CourseAchievementGroups

  for (const band of GRADE_BANDS) {
    const course = COURSE_PACKAGES[band]
    const bandEvents = accountEvents.filter((event) => event.gradeBand === band)
    const achievements: CourseAchievement[] = []

    course.parts.forEach((part, index) => {
      const knowledgeEvent = bandEvents.find((event) => (
        event.action === 'knowledge-completed' && event.contentId === part.id
      ))
      const challengeEvent = bandEvents.find((event) => (
        event.action === 'test-passed' && event.contentId === part.id
      ))
      const medal = course.medals[index]
      const hasWrongAnswer = unresolvedPartIds.has(part.id)

      achievements.push({
        id: `${part.id}:knowledge`,
        band,
        kind: 'knowledge',
        partId: part.id,
        name: `${medal.name} · 知识`,
        icon: medal.icon,
        description: `完成《${part.title}》知识学习`,
        earned: Boolean(knowledgeEvent),
        earnedAt: knowledgeEvent?.occurredAt ?? null,
        statusText: knowledgeEvent
          ? earnedDate(knowledgeEvent.occurredAt)
          : '先去认识这个主题',
      })
      achievements.push({
        id: `${part.id}:challenge`,
        band,
        kind: 'challenge',
        partId: part.id,
        name: `${medal.name} · 挑战`,
        icon: '⭐',
        description: `通过《${part.title}》测试挑战`,
        earned: Boolean(challengeEvent),
        earnedAt: challengeEvent?.occurredAt ?? null,
        statusText: challengeEvent
          ? earnedDate(challengeEvent.occurredAt)
          : knowledgeEvent && hasWrongAnswer
            ? '再试一次，订正后继续挑战'
            : knowledgeEvent
              ? '知识已点亮，下一步去挑战'
              : '先去认识这个主题',
      })
    })

    const prerequisites = course.parts.flatMap((part) => [
      bandEvents.find((event) => event.action === 'knowledge-completed' && event.contentId === part.id),
      bandEvents.find((event) => event.action === 'test-passed' && event.contentId === part.id),
    ])
    const earnedFinale = prerequisites.every(Boolean)
    const prerequisiteEvents = prerequisites.filter((event): event is LearningEvent => Boolean(event))
    const latest = latestDate(prerequisiteEvents)
    const hasUnresolvedWrong = course.parts.some((part) => unresolvedPartIds.has(part.id))
    const knowledgeComplete = course.parts.every((part) => (
      bandEvents.some((event) => event.action === 'knowledge-completed' && event.contentId === part.id)
    ))

    achievements.push({
      id: `${course.id}-finale`,
      band,
      kind: 'finale',
      name: course.finaleMedal.name,
      icon: '🏆',
      description: course.finaleMedal.description,
      earned: earnedFinale,
      earnedAt: earnedFinale ? latest : null,
      statusText: earnedFinale
        ? earnedDate(latest)
        : hasUnresolvedWrong
          ? '再试一次，订正后继续挑战'
          : knowledgeComplete
            ? '知识已点亮，下一步去挑战'
            : '先去认识这个主题',
    })
    groups[band] = achievements
  }

  return groups
}

export function getAchievementSummary(groups: CourseAchievementGroups) {
  const achievements = Object.values(groups).flat()
  return {
    earnedCount: achievements.filter((achievement) => achievement.earned).length,
    totalCount: achievements.length,
  }
}
