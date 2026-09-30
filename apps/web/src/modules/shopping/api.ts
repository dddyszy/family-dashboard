import type {
  AddItemInput,
  CreateListInput,
  ShoppingItem,
  ShoppingList,
  ShoppingSuggestion,
  UpdateItemInput,
  UpdateListInput,
} from '@shared/schemas/shopping'
import { api } from '@/lib/api'

export const shoppingApi = {
  lists: () => api.get<ShoppingList[]>('/lists'),
  createList: (input: CreateListInput) => api.post<ShoppingList>('/lists', input),
  updateList: (id: string, input: UpdateListInput) =>
    api.patch<ShoppingList>(`/lists/${id}`, input),
  deleteList: (id: string) => api.delete<{ ok: true }>(`/lists/${id}`),
  items: (listId: string) => api.get<ShoppingItem[]>(`/lists/${listId}/items`),
  addItems: (listId: string, inputs: AddItemInput[]) =>
    api.post<ShoppingItem[]>(`/lists/${listId}/items`, inputs),
  updateItem: (id: string, input: UpdateItemInput) =>
    api.patch<ShoppingItem>(`/items/${id}`, input),
  deleteItem: (id: string) => api.delete<{ ok: true }>(`/items/${id}`),
  clearChecked: (listId: string) => api.post<{ cleared: number }>(`/lists/${listId}/clear-checked`),
  suggest: (q: string) =>
    api.get<ShoppingSuggestion[]>(`/shopping/suggest?q=${encodeURIComponent(q)}`),
  frequent: () => api.get<ShoppingSuggestion[]>('/shopping/frequent'),
}
