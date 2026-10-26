import { describe, expect, it } from 'vitest'
import type { CourseId } from '../../app/learning'
import { getMapNodes } from './testMapData'

describe('test map S-shaped routes', () => {
  it.each([
    ['qmx', 8],
    ['cxd', 6],
    ['ael', 9],
  ] as const)('places every %s level on an even, safe S curve', (courseId: CourseId, expectedCount) => {
    const nodes = getMapNodes(courseId)
    expect(nodes).toHaveLength(expectedCount)

    const verticalSteps = nodes.slice(1).map((node, index) => (
      node.y - nodes[index].y
    ))
    for (const step of verticalSteps) expect(step).toBeCloseTo(verticalSteps[0], 8)
    expect(nodes[0].y).toBe(12)
    expect(nodes.at(-1)?.y).toBe(88)

    expect(nodes[0].x).toBe(50)
    expect(nodes.at(-1)?.x).toBe(50)
    const alternatingNodes = nodes.slice(1, -1)
    expect(alternatingNodes.map((node) => node.x)).toEqual(
      alternatingNodes.map((_, index) => index % 2 === 0 ? 28 : 72),
    )
    expect(nodes.every((node) => node.x >= 20 && node.x <= 80)).toBe(true)
  })
})
