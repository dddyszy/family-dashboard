import { DEFAULT_CATEGORY } from '@shared/constants'
import type {
  AddItemInput,
  CreateListInput,
  ShoppingItem,
  ShoppingList,
  ShoppingSuggestion,
  UpdateItemInput,
  UpdateListInput,
} from '@shared/schemas/shopping'
import { guessCategory, normalizeItemName, parseItemText } from '@shared/shopping-text'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { shoppingItems, shoppingLists } from '../db/schema'
import type { Deps, UserRow } from '../lib/context'
import { newId } from '../lib/crypto'
import { forbidden, notFound } from '../lib/errors'
import { audienceFor, canEdit, canView, type Viewer, visibleWhere } from '../lib/visibility'

type ListRow = typeof shoppingLists.$inferSelect
type ItemRow = typeof shoppingItems.$inferSelect

const FREQUENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function toItem(row: ItemRow): ShoppingItem {
  return {
    id: row.id,
    listId: row.listId,
    name: row.name,
    qty: row.qty,
    unit: row.unit,
    category: row.category,
    note: row.note,
    addedBy: row.addedBy,
    checked: row.checked,
    checkedBy: row.checkedBy,
    checkedAt: row.checkedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// Drizzle renders columns unqualified inside raw subqueries, so the correlation is spelled out.
const pendingCount = sql<number>`(
  select count(*) from "shopping_items" as "si"
  where "si"."list_id" = "shopping_lists"."id"
    and "si"."archived_at" is null
    and "si"."checked" = 0
)`

export function listLists(deps: Deps, viewer: Viewer): ShoppingList[] {
  return deps.db
    .select({ list: shoppingLists, pendingCount })
    .from(shoppingLists)
    .where(visibleWhere(shoppingLists, viewer))
    .orderBy(asc(shoppingLists.sort), asc(shoppingLists.createdAt))
    .all()
    .map(({ list, pendingCount }) => ({ ...list, pendingCount: Number(pendingCount) }))
}

function getListRow(deps: Deps, id: string): ListRow {
  const row = deps.db.select().from(shoppingLists).where(eq(shoppingLists.id, id)).get()
  if (!row) throw notFound('清单不存在')
  return row
}

function viewableList(deps: Deps, viewer: Viewer, id: string): ListRow {
  const row = getListRow(deps, id)
  if (!canView(row, viewer)) throw notFound('清单不存在')
  return row
}

function editableList(deps: Deps, viewer: Viewer, id: string): ListRow {
  const row = viewableList(deps, viewer, id)
  if (!canEdit(row, viewer)) throw forbidden('只有创建者可以修改私有清单')
  return row
}

function summarize(deps: Deps, row: ListRow): ShoppingList {
  const count =
    deps.db
      .select({ n: sql<number>`count(*)` })
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.listId, row.id),
          isNull(shoppingItems.archivedAt),
          eq(shoppingItems.checked, false),
        ),
      )
      .get()?.n ?? 0
  return { ...row, pendingCount: Number(count) }
}

export function createList(deps: Deps, user: UserRow, input: CreateListInput): ShoppingList {
  const ts = deps.now()
  const maxSort =
    deps.db
      .select({ max: sql<number | null>`max(${shoppingLists.sort})` })
      .from(shoppingLists)
      .get()?.max ?? 0
  const row: ListRow = {
    id: newId(),
    ownerId: user.id,
    visibility: input.visibility,
    name: input.name,
    icon: input.icon,
    color: input.color,
    sort: maxSort + 1,
    createdAt: ts,
    updatedAt: ts,
  }
  deps.db.insert(shoppingLists).values(row).run()
  deps.hub.broadcast('shopping.list.changed', { listId: row.id }, audienceFor(row))
  return { ...row, pendingCount: 0 }
}

export function updateList(
  deps: Deps,
  viewer: Viewer,
  id: string,
  input: UpdateListInput,
): ShoppingList {
  const before = editableList(deps, viewer, id)
  if (input.visibility && input.visibility !== before.visibility && viewer.kind === 'user') {
    if (before.ownerId !== viewer.userId) throw forbidden('只有创建者可以修改清单的共享范围')
  }
  deps.db
    .update(shoppingLists)
    .set({ ...input, updatedAt: deps.now() })
    .where(eq(shoppingLists.id, id))
    .run()
  const after = getListRow(deps, id)
  // Notify both the old and new audience so a list that became private disappears elsewhere.
  deps.hub.broadcast('shopping.list.changed', { listId: id }, audienceFor(before))
  if (before.visibility !== after.visibility) {
    deps.hub.broadcast('shopping.list.changed', { listId: id }, audienceFor(after))
  }
  return summarize(deps, after)
}

export function deleteList(deps: Deps, viewer: Viewer, id: string): void {
  const row = editableList(deps, viewer, id)
  deps.db.delete(shoppingLists).where(eq(shoppingLists.id, id)).run()
  deps.hub.broadcast('shopping.list.changed', { listId: null }, audienceFor(row))
}

export function listItems(deps: Deps, viewer: Viewer, listId: string): ShoppingItem[] {
  viewableList(deps, viewer, listId)
  return deps.db
    .select()
    .from(shoppingItems)
    .where(and(eq(shoppingItems.listId, listId), isNull(shoppingItems.archivedAt)))
    .orderBy(asc(shoppingItems.checked), asc(shoppingItems.createdAt))
    .all()
    .map(toItem)
}

type HistoryEntry = ShoppingSuggestion & { key: string; lastAt: number }

/** Legacy global history has no owner/list attribution, so derive suggestions from visible items. */
function visibleHistory(deps: Deps, viewer: Viewer): HistoryEntry[] {
  const rows = deps.db
    .select({ item: shoppingItems })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingLists.id, shoppingItems.listId))
    .where(visibleWhere(shoppingLists, viewer))
    .orderBy(desc(shoppingItems.updatedAt), desc(shoppingItems.createdAt))
    .all()
  const history = new Map<string, HistoryEntry>()
  for (const { item } of rows) {
    const key = normalizeItemName(item.name)
    let entry = history.get(key)
    if (!entry) {
      entry = { key, name: item.name, category: item.category, count: 0, lastAt: 0 }
      history.set(key, entry)
    }
    if (item.archivedAt !== null) {
      entry.count += 1
      entry.lastAt = Math.max(entry.lastAt, item.archivedAt)
    }
  }
  return [...history.values()]
}

function resolveItemFields(input: AddItemInput, categories: ReadonlyMap<string, string>) {
  const parsed = input.text ? parseItemText(input.text) : { name: '', qty: null, unit: null }
  const name = (input.name ?? parsed.name).trim()
  return {
    name,
    qty: input.qty !== undefined ? input.qty : parsed.qty,
    unit: input.unit !== undefined ? input.unit : parsed.unit,
    category:
      input.category ||
      categories.get(normalizeItemName(name)) ||
      guessCategory(name) ||
      DEFAULT_CATEGORY,
    note: input.note ?? null,
  }
}

export function addItems(
  deps: Deps,
  user: UserRow,
  listId: string,
  inputs: AddItemInput[],
): ShoppingItem[] {
  const list = editableList(deps, { kind: 'user', userId: user.id }, listId)
  const ts = deps.now()
  const categories = new Map(
    visibleHistory(deps, { kind: 'user', userId: user.id }).map((entry) => [
      entry.key,
      entry.category,
    ]),
  )
  const rows: ItemRow[] = inputs
    .map((input) => resolveItemFields(input, categories))
    .filter((fields) => fields.name.length > 0)
    .map((fields, index) => ({
      id: newId(),
      listId,
      ...fields,
      addedBy: user.id,
      checked: false,
      checkedBy: null,
      checkedAt: null,
      archivedAt: null,
      // Keeps batch-pasted items in their pasted order.
      createdAt: ts + index,
      updatedAt: ts + index,
    }))
  if (rows.length === 0) return []
  deps.db.insert(shoppingItems).values(rows).run()
  const audience = audienceFor(list)
  for (const row of rows) {
    deps.hub.broadcast('shopping.item.created', { listId, item: toItem(row) }, audience)
  }
  return rows.map(toItem)
}

function editableItem(
  deps: Deps,
  viewer: Viewer,
  itemId: string,
): { item: ItemRow; list: ListRow } {
  const item = deps.db.select().from(shoppingItems).where(eq(shoppingItems.id, itemId)).get()
  if (!item || item.archivedAt) throw notFound('商品不存在')
  const list = editableList(deps, viewer, item.listId)
  return { item, list }
}

export function updateItem(
  deps: Deps,
  user: UserRow,
  itemId: string,
  input: UpdateItemInput,
): ShoppingItem {
  const { item, list } = editableItem(deps, { kind: 'user', userId: user.id }, itemId)
  const ts = deps.now()
  const patch: Partial<ItemRow> = { updatedAt: ts }
  if (input.name !== undefined) patch.name = input.name
  if (input.qty !== undefined) patch.qty = input.qty
  if (input.unit !== undefined) patch.unit = input.unit
  if (input.note !== undefined) patch.note = input.note
  if (input.category !== undefined) patch.category = input.category
  if (input.checked !== undefined && input.checked !== item.checked) {
    patch.checked = input.checked
    patch.checkedBy = input.checked ? user.id : null
    patch.checkedAt = input.checked ? ts : null
  }
  deps.db.update(shoppingItems).set(patch).where(eq(shoppingItems.id, itemId)).run()
  const updated = toItem({ ...item, ...patch })
  deps.hub.broadcast('shopping.item.updated', { listId: list.id, item: updated }, audienceFor(list))
  return updated
}

export function deleteItem(deps: Deps, user: UserRow, itemId: string): void {
  const { list } = editableItem(deps, { kind: 'user', userId: user.id }, itemId)
  deps.db.delete(shoppingItems).where(eq(shoppingItems.id, itemId)).run()
  deps.hub.broadcast('shopping.item.deleted', { listId: list.id, itemId }, audienceFor(list))
}

export function clearChecked(deps: Deps, user: UserRow, listId: string): number {
  const list = editableList(deps, { kind: 'user', userId: user.id }, listId)
  const checked = deps.db
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.listId, listId),
        isNull(shoppingItems.archivedAt),
        eq(shoppingItems.checked, true),
      ),
    )
    .all()
  if (checked.length === 0) return 0
  const ts = deps.now()
  deps.db.transaction((tx) => {
    tx.update(shoppingItems)
      .set({ archivedAt: ts, updatedAt: ts })
      .where(
        inArray(
          shoppingItems.id,
          checked.map((i) => i.id),
        ),
      )
      .run()
  })
  deps.hub.broadcast('shopping.items.cleared', { listId }, audienceFor(list))
  return checked.length
}

function toSuggestion({ name, category, count }: HistoryEntry): ShoppingSuggestion {
  return { name, category, count }
}

export function suggest(deps: Deps, viewer: Viewer, query: string): ShoppingSuggestion[] {
  const q = normalizeItemName(query)
  if (!q) return []
  return visibleHistory(deps, viewer)
    .filter((entry) => entry.key.includes(q))
    .sort(
      (a, b) =>
        Number(b.key.startsWith(q)) - Number(a.key.startsWith(q)) ||
        b.count - a.count ||
        b.lastAt - a.lastAt,
    )
    .slice(0, 8)
    .map(toSuggestion)
}

export function frequent(deps: Deps, viewer: Viewer): ShoppingSuggestion[] {
  return visibleHistory(deps, viewer)
    .filter((entry) => entry.lastAt > deps.now() - FREQUENT_WINDOW_MS && entry.count > 0)
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, 10)
    .map(toSuggestion)
}

export function pendingItemsByList(
  deps: Deps,
  listIds: string[],
  perList = 30,
): Record<string, ShoppingItem[]> {
  const result: Record<string, ShoppingItem[]> = {}
  if (listIds.length === 0) return result
  const rows = deps.db
    .select()
    .from(shoppingItems)
    .where(
      and(
        inArray(shoppingItems.listId, listIds),
        isNull(shoppingItems.archivedAt),
        eq(shoppingItems.checked, false),
      ),
    )
    .orderBy(asc(shoppingItems.createdAt))
    .all()
  for (const id of listIds) result[id] = []
  for (const row of rows) {
    const bucket = result[row.listId]
    if (bucket && bucket.length < perList) bucket.push(toItem(row))
  }
  return result
}
