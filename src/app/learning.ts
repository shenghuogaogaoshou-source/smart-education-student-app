export const PRIMARY_GRADES = ['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'] as const
export type PrimaryGrade = typeof PRIMARY_GRADES[number]
export type GradeBand = 'grade1-2' | 'grade3-4' | 'grade5-6'
export type CourseId = 'qmx' | 'cxd' | 'ael'
export type CoursePartId = `${CourseId}-${number}`

export const GRADE_LABELS: Record<PrimaryGrade, string> = {
  grade1: '一年级', grade2: '二年级', grade3: '三年级',
  grade4: '四年级', grade5: '五年级', grade6: '六年级',
}

export const GRADE_BAND_LABELS: Record<GradeBand, string> = {
  'grade1-2': '1—2 年级',
  'grade3-4': '3—4 年级',
  'grade5-6': '5—6 年级',
}

export type BandProgress = {
  knowledgeCompleted: CoursePartId[]
  testsPassed: CoursePartId[]
}

export type LearningProgress = Record<GradeBand, BandProgress>

export const COURSE_PART_COUNTS: Record<GradeBand, number> = {
  'grade1-2': 8,
  'grade3-4': 6,
  'grade5-6': 9,
}

export function getGradeBand(grade: PrimaryGrade): GradeBand {
  if (grade === 'grade1' || grade === 'grade2') return 'grade1-2'
  if (grade === 'grade3' || grade === 'grade4') return 'grade3-4'
  return 'grade5-6'
}

export function getCourseIdForBand(band: GradeBand): CourseId {
  return { 'grade1-2': 'qmx', 'grade3-4': 'cxd', 'grade5-6': 'ael' }[band] as CourseId
}

export function makeCoursePartId(courseId: CourseId, partNumber: number): CoursePartId {
  if (!Number.isInteger(partNumber) || partNumber < 1) throw new Error('invalid_course_part')
  return `${courseId}-${partNumber}`
}

export function getPartIdsForBand(band: GradeBand): CoursePartId[] {
  const courseId = getCourseIdForBand(band)
  return Array.from({ length: COURSE_PART_COUNTS[band] }, (_, index) => makeCoursePartId(courseId, index + 1))
}

export function createEmptyLearningProgress(): LearningProgress {
  return {
    'grade1-2': { knowledgeCompleted: [], testsPassed: [] },
    'grade3-4': { knowledgeCompleted: [], testsPassed: [] },
    'grade5-6': { knowledgeCompleted: [], testsPassed: [] },
  }
}

export function getResumeKnowledgePart(state: {
  grade: PrimaryGrade
  learningProgress: LearningProgress
}): CoursePartId {
  const band = getGradeBand(state.grade)
  const partIds = getPartIdsForBand(band)
  const completed = new Set(state.learningProgress[band].knowledgeCompleted)
  const mostRecentCompleted = [...state.learningProgress[band].knowledgeCompleted]
    .reverse()
    .find((partId) => partIds.includes(partId))

  if (!mostRecentCompleted) return partIds[0]

  const resumeAfterIndex = partIds.indexOf(mostRecentCompleted) + 1
  return partIds.slice(resumeAfterIndex).find((partId) => !completed.has(partId))
    ?? partIds.find((partId) => !completed.has(partId))
    ?? partIds.at(-1)!
}

export function isTestUnlocked(progress: BandProgress, partId: CoursePartId) {
  return progress.knowledgeCompleted.includes(partId)
}
