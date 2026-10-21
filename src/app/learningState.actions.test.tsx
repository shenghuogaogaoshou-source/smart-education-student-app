import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider, useAppState } from './AppState'
import { getGradeBand, getPartIdsForBand, type CoursePartId, type PrimaryGrade } from './learning'
import { createDefaultState } from './model'
import { getPointsBalance } from './points'
import { loadAccountState, saveAccountState } from './companionAccountRepository'
import { getCourseForBand } from '../features/knowledge/courseCatalog'

const pairedGrade: Record<PrimaryGrade, PrimaryGrade> = {
  grade1: 'grade2', grade2: 'grade1', grade3: 'grade4',
  grade4: 'grade3', grade5: 'grade6', grade6: 'grade5',
}

function seedEmptyProgress(grade: PrimaryGrade, completedPartIds: CoursePartId[] = []) {
  const state = createDefaultState()
  state.grade = grade
  state.learningProgress = {
    'grade1-2': { knowledgeCompleted: [], testsPassed: [] },
    'grade3-4': { knowledgeCompleted: [], testsPassed: [] },
    'grade5-6': { knowledgeCompleted: [], testsPassed: [] },
  }
  state.learningProgress[getGradeBand(grade)] = {
    knowledgeCompleted: completedPartIds,
    testsPassed: completedPartIds,
  }
  state.processedRewardIds = state.transactions.map((tx) => tx.eventId)
  saveAccountState(state.accountId, state)
}

function Harness({ grade, partId, title, lockedPartId }: {
  grade: PrimaryGrade
  partId: CoursePartId
  title: string
  lockedPartId: CoursePartId
}) {
  const app = useAppState()
  const band = getGradeBand(app.state.grade as PrimaryGrade)
  return (
    <>
      <output aria-label="balance">{getPointsBalance(app.state.transactions)}</output>
      <output aria-label="knowledge">{app.state.learningProgress[band].knowledgeCompleted.join(',')}</output>
      <output aria-label="tests">{app.state.learningProgress[band].testsPassed.join(',')}</output>
      <button type="button" onClick={() => app.completeKnowledge(partId, title)}>完成知识</button>
      <button type="button" onClick={() => app.passTest(partId, title)}>通过测试</button>
      <button type="button" onClick={() => app.passTest(lockedPartId, '未学知识')}>越过知识直接测试</button>
      <button type="button" onClick={() => app.setGrade(pairedGrade[grade])}>切换同段年级</button>
    </>
  )
}

function GradeSwitchHarness() {
  const app = useAppState()
  const band = getGradeBand(app.state.grade as PrimaryGrade)
  return (
    <>
      <output aria-label="active progress">{app.state.learningProgress[band].knowledgeCompleted.join(',')}</output>
      <button type="button" onClick={() => app.setGrade('grade6')}>切到六年级</button>
      <button type="button" onClick={() => app.setGrade('grade3')}>切到三年级</button>
      <button type="button" onClick={() => app.setGrade('grade5')}>切回五年级</button>
    </>
  )
}

describe('learning progress actions', () => {
  beforeEach(() => localStorage.clear())

  const cases = [
    ['grade1', 'qmx-1', '启明星岛', 'qmx-2'],
    ['grade3', 'cxd-1', 'AI 超能力图鉴', 'cxd-2'],
    ['grade5', 'ael-1', 'AI 系统拆解站', 'ael-2'],
  ] as const

  it.each(cases)('persists each first-chapter reward once for %s', async (grade, partId, title, lockedPartId) => {
    seedEmptyProgress(grade)
    const user = userEvent.setup()
    const view = render(<AppStateProvider><Harness grade={grade} partId={partId} title={title} lockedPartId={lockedPartId} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '完成知识' }))
    await user.click(screen.getByRole('button', { name: '完成知识' }))
    await user.click(screen.getByRole('button', { name: '通过测试' }))
    await user.click(screen.getByRole('button', { name: '通过测试' }))
    await user.click(screen.getByRole('button', { name: '切换同段年级' }))
    await user.click(screen.getByRole('button', { name: '完成知识' }))
    await user.click(screen.getByRole('button', { name: '通过测试' }))

    expect(screen.getByLabelText('balance')).toHaveTextContent('2100')
    expect(screen.getByLabelText('knowledge')).toHaveTextContent(partId)
    expect(screen.getByLabelText('tests')).toHaveTextContent(partId)
    let saved = loadAccountState(createDefaultState().accountId)
    expect(saved.learningProgress[getGradeBand(grade)].knowledgeCompleted).toEqual([partId])
    expect(saved.learningProgress[getGradeBand(grade)].testsPassed).toEqual([partId])
    for (const [kind, amount] of [['knowledge', 30], ['test', 50], ['medal', 20]] as const) {
      const eventId = `${kind}:${partId}`
      expect(saved.transactions.filter((tx: { eventId: string }) => tx.eventId === eventId)).toHaveLength(1)
      expect(saved.transactions.find((tx: { eventId: string }) => tx.eventId === eventId)).toMatchObject({ amount, kind })
      expect(saved.processedRewardIds.filter((id: string) => id === eventId)).toHaveLength(1)
    }
    expect(saved.transactions.filter((tx: { kind: string }) => tx.kind === 'band')).toHaveLength(0)

    view.unmount()
    render(<AppStateProvider><Harness grade={grade} partId={partId} title={title} lockedPartId={lockedPartId} /></AppStateProvider>)
    await user.click(screen.getByRole('button', { name: '完成知识' }))
    await user.click(screen.getByRole('button', { name: '通过测试' }))
    saved = loadAccountState(createDefaultState().accountId)
    expect(saved.transactions.filter((tx: { eventId: string }) => tx.eventId.endsWith(`:${partId}`))).toHaveLength(3)
    expect(screen.getByLabelText('balance')).toHaveTextContent('2100')
  })

  it.each(cases)('persists the final chapter and band reward once for %s', async (grade) => {
    const band = getGradeBand(grade)
    const allPartIds = getPartIdsForBand(band)
    const finalPart = getCourseForBand(band).parts.at(-1)!
    expect(allPartIds.at(-1)).toBe(finalPart.id)
    seedEmptyProgress(grade, allPartIds.slice(0, -1))
    const user = userEvent.setup()
    render(<AppStateProvider><Harness grade={grade} partId={finalPart.id} title={finalPart.title} lockedPartId={finalPart.id} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '完成知识' }))
    await user.click(screen.getByRole('button', { name: '通过测试' }))
    await user.click(screen.getByRole('button', { name: '通过测试' }))
    await user.click(screen.getByRole('button', { name: '切换同段年级' }))
    await user.click(screen.getByRole('button', { name: '完成知识' }))

    const saved = loadAccountState(createDefaultState().accountId)
    expect(saved.transactions.filter((tx: { eventId: string }) => [
      `knowledge:${finalPart.id}`, `test:${finalPart.id}`, `medal:${finalPart.id}`, `band:${band}`,
    ].includes(tx.eventId)).map((tx: { eventId: string; amount: number }) => [tx.eventId, tx.amount])).toEqual([
      [`knowledge:${finalPart.id}`, 30],
      [`test:${finalPart.id}`, 50],
      [`medal:${finalPart.id}`, 20],
      [`band:${band}`, 100],
    ])
    expect(saved.processedRewardIds.filter((id: string) => id === `band:${band}`)).toHaveLength(1)
    expect(screen.getByLabelText('balance')).toHaveTextContent('2200')
  })

  it('keeps each grade band progress when the concrete grade changes', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><GradeSwitchHarness /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '切到六年级' }))
    expect(screen.getByLabelText('active progress')).toHaveTextContent('ael-1,ael-2,ael-3')
    await user.click(screen.getByRole('button', { name: '切到三年级' }))
    expect(screen.getByLabelText('active progress')).toBeEmptyDOMElement()
    await user.click(screen.getByRole('button', { name: '切回五年级' }))
    expect(screen.getByLabelText('active progress')).toHaveTextContent('ael-1,ael-2,ael-3')
  })

  it.each(cases)('rejects a test before knowledge for %s', async (grade, partId, title, lockedPartId) => {
    seedEmptyProgress(grade)
    const user = userEvent.setup()
    render(<AppStateProvider><Harness grade={grade} partId={partId} title={title} lockedPartId={lockedPartId} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '越过知识直接测试' }))

    expect(screen.getByLabelText('tests')).not.toHaveTextContent(lockedPartId)
    expect(screen.getByLabelText('balance')).toHaveTextContent('2000')
    const saved = loadAccountState(createDefaultState().accountId)
    expect(saved.transactions.filter((tx: { eventId: string }) => tx.eventId.endsWith(`:${lockedPartId}`))).toHaveLength(0)
  })
})
