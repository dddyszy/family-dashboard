import { describe, expect, test } from 'bun:test'
import { createClock, createTestDeps, seedUser } from '../test-utils'
import {
  addItems,
  clearChecked,
  createList,
  frequent,
  listItems,
  listLists,
  suggest,
  updateItem,
} from './shopping'

async function setup() {
  const clock = createClock()
  const deps = createTestDeps(clock)
  const dad = await seedUser(deps, 'dad', 'admin')
  const mom = await seedUser(deps, 'mom')
  const events: Array<{ event: string; to: string }> = []
  deps.hub.add({ kind: 'user', userId: dad.id }, (event) => events.push({ event, to: 'dad' }))
  deps.hub.add({ kind: 'user', userId: mom.id }, (event) => events.push({ event, to: 'mom' }))
  deps.hub.add({ kind: 'device' }, (event) => events.push({ event, to: 'kiosk' }))
  return { deps, clock, dad, mom, events }
}

describe('shopping lists', () => {
  test('parses free text and guesses categories when adding', async () => {
    const { deps, dad } = await setup()
    const list = createList(deps, dad, {
      name: '超市',
      icon: 'cart',
      color: '#30d158',
      visibility: 'family',
    })
    const [eggs, pork] = addItems(deps, dad, list.id, [
      { text: '鸡蛋 2盒' },
      { text: '2斤 五花肉' },
    ])
    expect(eggs).toMatchObject({ name: '鸡蛋', qty: 2, unit: '盒', category: '肉蛋' })
    expect(pork).toMatchObject({ name: '五花肉', qty: 2, unit: '斤', category: '肉蛋' })
    expect(listLists(deps, { kind: 'user', userId: dad.id })[0]?.pendingCount).toBe(2)
  })

  test('private lists are hidden from other members and devices', async () => {
    const { deps, dad, mom, events } = await setup()
    createList(deps, dad, { name: '私房', icon: 'cart', color: '#30d158', visibility: 'private' })
    expect(listLists(deps, { kind: 'user', userId: mom.id })).toHaveLength(0)
    expect(listLists(deps, { kind: 'device' })).toHaveLength(0)
    expect(events.map((e) => e.to)).toEqual(['dad'])
    expect(() =>
      listItems(
        deps,
        { kind: 'user', userId: mom.id },
        listLists(deps, { kind: 'user', userId: dad.id })[0]?.id ?? '',
      ),
    ).toThrow()
  })

  test('family list changes reach every member and kiosk', async () => {
    const { deps, dad, events } = await setup()
    const list = createList(deps, dad, {
      name: '超市',
      icon: 'cart',
      color: '#30d158',
      visibility: 'family',
    })
    events.length = 0
    addItems(deps, dad, list.id, [{ text: '牛奶' }])
    expect(
      events
        .filter((e) => e.event === 'shopping.item.created')
        .map((e) => e.to)
        .sort(),
    ).toEqual(['dad', 'kiosk', 'mom'])
  })

  test('checking records who checked, clearing archives and feeds history', async () => {
    const { deps, clock, dad, mom } = await setup()
    const list = createList(deps, dad, {
      name: '超市',
      icon: 'cart',
      color: '#30d158',
      visibility: 'family',
    })
    const [milk, bread] = addItems(deps, dad, list.id, [{ text: '牛奶' }, { text: '面包' }])
    if (!milk || !bread) throw new Error('items missing')

    clock.advance(1000)
    const checked = updateItem(deps, mom, milk.id, { checked: true })
    expect(checked).toMatchObject({ checked: true, checkedBy: mom.id })

    expect(clearChecked(deps, dad, list.id)).toBe(1)
    expect(listItems(deps, { kind: 'user', userId: dad.id }, list.id).map((i) => i.name)).toEqual([
      '面包',
    ])
    expect(frequent(deps)).toEqual([{ name: '牛奶', category: '乳品', count: 1 }])
    expect(suggest(deps, '牛').map((s) => s.name)).toEqual(['牛奶'])
  })

  test('category corrections are remembered for the next add', async () => {
    const { deps, dad } = await setup()
    const list = createList(deps, dad, {
      name: '超市',
      icon: 'cart',
      color: '#30d158',
      visibility: 'family',
    })
    const [item] = addItems(deps, dad, list.id, [{ text: '猫粮' }])
    if (!item) throw new Error('item missing')
    expect(item.category).toBe('其他')
    updateItem(deps, dad, item.id, { category: '日用' })
    const [again] = addItems(deps, dad, list.id, [{ text: '猫粮' }])
    expect(again?.category).toBe('日用')
  })
})
