import { describe, expect, test } from 'bun:test'
import { guessCategory, parseItemText } from './shopping-text'

describe('parseItemText', () => {
  test('trailing quantity with unit', () => {
    expect(parseItemText('鸡蛋 2盒')).toEqual({ name: '鸡蛋', qty: 2, unit: '盒' })
    expect(parseItemText('鸡蛋2盒')).toEqual({ name: '鸡蛋', qty: 2, unit: '盒' })
  })

  test('multiplier syntax', () => {
    expect(parseItemText('牛奶x3')).toEqual({ name: '牛奶', qty: 3, unit: null })
    expect(parseItemText('牛奶 × 3')).toEqual({ name: '牛奶', qty: 3, unit: null })
  })

  test('leading quantity', () => {
    expect(parseItemText('2斤 五花肉')).toEqual({ name: '五花肉', qty: 2, unit: '斤' })
    expect(parseItemText('1.5kg 牛肉')).toEqual({ name: '牛肉', qty: 1.5, unit: 'kg' })
  })

  test('plain name', () => {
    expect(parseItemText('  苹果 ')).toEqual({ name: '苹果', qty: null, unit: null })
  })

  test('keeps digits that belong to the name', () => {
    expect(parseItemText('iPhone15')).toEqual({ name: 'iPhone15', qty: null, unit: null })
  })

  test('drink and produce units', () => {
    expect(parseItemText('酸奶 4杯')).toEqual({ name: '酸奶', qty: 4, unit: '杯' })
    expect(parseItemText('大蒜 2头')).toEqual({ name: '大蒜', qty: 2, unit: '头' })
  })

  test('space-separated count without unit', () => {
    expect(parseItemText('可乐 6')).toEqual({ name: '可乐', qty: 6, unit: null })
  })
})

describe('guessCategory', () => {
  test('maps common items', () => {
    expect(guessCategory('西红柿')).toBe('蔬果')
    expect(guessCategory('五花肉')).toBe('肉蛋')
    expect(guessCategory('酸奶')).toBe('乳品')
    expect(guessCategory('洗衣液')).toBe('清洁')
    expect(guessCategory('神秘物品')).toBeNull()
  })
})
