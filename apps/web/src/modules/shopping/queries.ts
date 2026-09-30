import { DEFAULT_CATEGORY } from '@shared/constants'
import type { HomeData } from '@shared/schemas/home'
import type {
  AddItemInput,
  CreateListInput,
  ShoppingItem,
  ShoppingList,
  UpdateItemInput,
  UpdateListInput,
} from '@shared/schemas/shopping'
import { guessCategory, parseItemText } from '@shared/shopping-text'
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '@/lib/api'
import { useCurrentUser } from '@/modules/auth/queries'
import { homeKeys } from '@/modules/home/queries'
import { toast } from '@/stores/ui'
import { shoppingApi } from './api'

export const shoppingKeys = {
  all: ['shopping'] as const,
  lists: ['shopping', 'lists'] as const,
  items: (listId: string) => ['shopping', 'items', listId] as const,
  frequent: ['shopping', 'frequent'] as const,
  suggest: (q: string) => ['shopping', 'suggest', q] as const,
}

export function useLists() {
  return useQuery({ queryKey: shoppingKeys.lists, queryFn: shoppingApi.lists })
}

export function useItems(listId: string | undefined) {
  return useQuery({
    queryKey: shoppingKeys.items(listId ?? ''),
    queryFn: () => shoppingApi.items(listId ?? ''),
    enabled: Boolean(listId),
  })
}

export function useFrequent(enabled = true) {
  return useQuery({
    queryKey: shoppingKeys.frequent,
    queryFn: shoppingApi.frequent,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useSuggestions(q: string) {
  const query = q.trim()
  return useQuery({
    queryKey: shoppingKeys.suggest(query),
    queryFn: () => shoppingApi.suggest(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  })
}

type ItemChange = { type: 'upsert'; item: ShoppingItem } | { type: 'remove'; itemId: string }

function isPending(item: ShoppingItem | undefined): boolean {
  return Boolean(item && !item.checked)
}

/** Applies one item change to every cache that shows it: the list's items, home data and list counts. */
export function applyItemChange(qc: QueryClient, listId: string, change: ItemChange): void {
  const itemsKey = shoppingKeys.items(listId)
  const items = qc.getQueryData<ShoppingItem[]>(itemsKey)
  const home = qc.getQueryData<HomeData>(homeKeys.home)
  const id = change.type === 'upsert' ? change.item.id : change.itemId
  const before =
    items?.find((i) => i.id === id) ?? home?.shopping.pendingItems[listId]?.find((i) => i.id === id)
  const after = change.type === 'upsert' ? change.item : undefined
  const delta = (isPending(after) ? 1 : 0) - (isPending(before) ? 1 : 0)

  if (items) {
    const rest = items.filter((i) => i.id !== id)
    qc.setQueryData(
      itemsKey,
      after ? [...rest, after].sort((a, b) => a.createdAt - b.createdAt) : rest,
    )
  }
  if (home) {
    const pending = (home.shopping.pendingItems[listId] ?? []).filter((i) => i.id !== id)
    if (after && !after.checked) pending.push(after)
    pending.sort((a, b) => a.createdAt - b.createdAt)
    qc.setQueryData<HomeData>(homeKeys.home, {
      ...home,
      shopping: {
        lists: home.shopping.lists.map((l) =>
          l.id === listId ? { ...l, pendingCount: Math.max(0, l.pendingCount + delta) } : l,
        ),
        pendingItems: { ...home.shopping.pendingItems, [listId]: pending },
      },
    })
  }
  if (delta !== 0) {
    qc.setQueryData<ShoppingList[]>(shoppingKeys.lists, (lists) =>
      lists?.map((l) =>
        l.id === listId ? { ...l, pendingCount: Math.max(0, l.pendingCount + delta) } : l,
      ),
    )
  }
}

function refreshListsAndHome(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: shoppingKeys.lists })
  void qc.invalidateQueries({ queryKey: homeKeys.home })
}

export function useAddItems(listId: string) {
  const qc = useQueryClient()
  const user = useCurrentUser()
  return useMutation({
    mutationFn: (inputs: AddItemInput[]) => shoppingApi.addItems(listId, inputs),
    onMutate: (inputs) => {
      const now = Date.now()
      const temps: ShoppingItem[] = inputs.map((input, index) => {
        const parsed = parseItemText(input.text ?? input.name ?? '')
        const name = input.name ?? parsed.name
        return {
          id: `temp-${now}-${index}`,
          listId,
          name,
          qty: input.qty ?? parsed.qty,
          unit: input.unit ?? parsed.unit,
          category: input.category ?? guessCategory(name) ?? DEFAULT_CATEGORY,
          note: null,
          addedBy: user?.id ?? '',
          checked: false,
          checkedBy: null,
          checkedAt: null,
          createdAt: now + index,
          updatedAt: now + index,
        }
      })
      for (const item of temps) applyItemChange(qc, listId, { type: 'upsert', item })
      return { temps }
    },
    onSuccess: (items, _inputs, context) => {
      for (const temp of context?.temps ?? [])
        applyItemChange(qc, listId, { type: 'remove', itemId: temp.id })
      for (const item of items) applyItemChange(qc, listId, { type: 'upsert', item })
    },
    onError: (error, _inputs, context) => {
      for (const temp of context?.temps ?? [])
        applyItemChange(qc, listId, { type: 'remove', itemId: temp.id })
      toast.error(errorMessage(error))
    },
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  const user = useCurrentUser()
  return useMutation({
    mutationFn: ({ item, input }: { item: ShoppingItem; input: UpdateItemInput }) =>
      shoppingApi.updateItem(item.id, input),
    onMutate: ({ item, input }) => {
      const optimistic: ShoppingItem = {
        ...item,
        ...input,
        ...(input.checked !== undefined
          ? {
              checkedBy: input.checked ? (user?.id ?? null) : null,
              checkedAt: input.checked ? Date.now() : null,
            }
          : {}),
      }
      applyItemChange(qc, item.listId, { type: 'upsert', item: optimistic })
      return { previous: item }
    },
    onSuccess: (item) => applyItemChange(qc, item.listId, { type: 'upsert', item }),
    onError: (error, _vars, context) => {
      if (context)
        applyItemChange(qc, context.previous.listId, { type: 'upsert', item: context.previous })
      toast.error(errorMessage(error))
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: ShoppingItem) => shoppingApi.deleteItem(item.id),
    onMutate: (item) => applyItemChange(qc, item.listId, { type: 'remove', itemId: item.id }),
    onError: (error, item) => {
      applyItemChange(qc, item.listId, { type: 'upsert', item })
      toast.error(errorMessage(error))
    },
  })
}

export function useClearChecked(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => shoppingApi.clearChecked(listId),
    onMutate: () => {
      const items = qc.getQueryData<ShoppingItem[]>(shoppingKeys.items(listId)) ?? []
      for (const item of items.filter((i) => i.checked)) {
        applyItemChange(qc, listId, { type: 'remove', itemId: item.id })
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: shoppingKeys.items(listId) })
      void qc.invalidateQueries({ queryKey: shoppingKeys.frequent })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useCreateList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListInput) => shoppingApi.createList(input),
    onSuccess: () => refreshListsAndHome(qc),
  })
}

export function useUpdateList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateListInput }) =>
      shoppingApi.updateList(id, input),
    onSuccess: () => refreshListsAndHome(qc),
  })
}

export function useDeleteList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => shoppingApi.deleteList(id),
    onSuccess: () => refreshListsAndHome(qc),
  })
}
