import { describe, expect, test } from 'bun:test'
import {
  appendToLayouts,
  compactLayout,
  layoutsForSizes,
  packLayout,
  removeFromLayouts,
  sizeOf,
} from './layout'

describe('packLayout', () => {
  test('fills rows left to right and wraps', () => {
    const items = packLayout(
      [
        { i: 'a', w: 4, h: 2 },
        { i: 'b', w: 4, h: 2 },
        { i: 'c', w: 4, h: 2 },
      ],
      8,
    )
    expect(items).toEqual([
      { i: 'a', x: 0, y: 0, w: 4, h: 2 },
      { i: 'b', x: 4, y: 0, w: 4, h: 2 },
      { i: 'c', x: 0, y: 2, w: 4, h: 2 },
    ])
  })

  test('fills holes next to tall items', () => {
    const items = packLayout(
      [
        { i: 'tall', w: 4, h: 4 },
        { i: 's1', w: 2, h: 2 },
        { i: 's2', w: 2, h: 2 },
        { i: 's3', w: 2, h: 2 },
      ],
      8,
    )
    expect(items.map((i) => [i.i, i.x, i.y])).toEqual([
      ['tall', 0, 0],
      ['s1', 4, 0],
      ['s2', 6, 0],
      ['s3', 4, 2],
    ])
  })

  test('clamps widths to the column count', () => {
    expect(packLayout([{ i: 'a', w: 6, h: 2 }], 4)[0]?.w).toBe(4)
  })
})

describe('compactLayout', () => {
  test('closes vertical gaps left by removed widgets', () => {
    const items = compactLayout(
      [
        { i: 'a', x: 0, y: 0, w: 4, h: 2 },
        { i: 'b', x: 0, y: 6, w: 4, h: 2 },
        { i: 'c', x: 4, y: 3, w: 4, h: 2 },
      ],
      8,
    )
    expect(items.map((i) => [i.i, i.y])).toEqual([
      ['a', 0],
      ['c', 0],
      ['b', 2],
    ])
  })

  test('drops unknown ids and appends missing widgets', () => {
    const items = compactLayout([{ i: 'gone', x: 0, y: 0, w: 2, h: 2 }], 4, ['new'])
    expect(items).toEqual([{ i: 'new', x: 0, y: 0, w: 2, h: 2 }])
  })
})

describe('layout helpers', () => {
  test('append places new widgets at the bottom of every breakpoint', () => {
    const base = layoutsForSizes([{ id: 'a', size: 'L' }])
    const next = appendToLayouts(base, 'b', 'S')
    expect(next.lg.find((i) => i.i === 'b')).toEqual({ i: 'b', x: 0, y: 4, w: 2, h: 2 })
    expect(removeFromLayouts(next, 'b').lg).toHaveLength(1)
  })

  test('sizeOf maps dimensions back to named sizes', () => {
    expect(sizeOf({ w: 2, h: 2 })).toBe('S')
    expect(sizeOf({ w: 4, h: 2 })).toBe('M')
    expect(sizeOf({ w: 4, h: 4 })).toBe('L')
    expect(sizeOf({ w: 4, h: 6 })).toBe('XL')
  })
})
