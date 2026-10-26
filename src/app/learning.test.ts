import { describe, expect, it } from 'vitest'
import {
  createEmptyLearningProgress,
  getCourseIdForBand,
  getGradeBand,
  getPartIdsForBand,
  getResumeKnowledgePart,
  isTestUnlocked,
  makeCoursePartId,
  PRIMARY_GRADES,
} from './learning'

describe('primary learning domain', () => {
  it('resumes at the first unfinished knowledge part after the most recent completion', () => {
    const progress = createEmptyLearningProgress()
    progress['grade5-6'].knowledgeCompleted = ['ael-1', 'ael-3']

    expect(getResumeKnowledgePart({ grade: 'grade5', learningProgress: progress })).toBe('ael-4')
  })

  it('resumes at the first part when nothing is complete and the last part when all are complete', () => {
    const empty = createEmptyLearningProgress()
    expect(getResumeKnowledgePart({ grade: 'grade3', learningProgress: empty })).toBe('cxd-1')

    const complete = createEmptyLearningProgress()
    complete['grade1-2'].knowledgeCompleted = getPartIdsForBand('grade1-2')
    expect(getResumeKnowledgePart({ grade: 'grade1', learningProgress: complete })).toBe('qmx-8')
  })

  it('maps all six grades into the three approved bands', () => {
    expect(PRIMARY_GRADES).toEqual(['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'])
    expect(PRIMARY_GRADES.map(getGradeBand)).toEqual([
      'grade1-2', 'grade1-2', 'grade3-4', 'grade3-4', 'grade5-6', 'grade5-6',
    ])
  })

  it('maps each band to one course package', () => {
    expect(getCourseIdForBand('grade1-2')).toBe('qmx')
    expect(getCourseIdForBand('grade3-4')).toBe('cxd')
    expect(getCourseIdForBand('grade5-6')).toBe('ael')
  })

  it('unlocks a test only after matching knowledge is complete', () => {
    const progress = createEmptyLearningProgress()
    const id = makeCoursePartId('ael', 1)
    expect(isTestUnlocked(progress['grade5-6'], id)).toBe(false)
    progress['grade5-6'].knowledgeCompleted.push(id)
    expect(isTestUnlocked(progress['grade5-6'], id)).toBe(true)
  })
})
