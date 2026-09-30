import { z } from 'zod'
import { colorSchema, visibilitySchema } from './common'

export type ShoppingList = {
  id: string
  ownerId: string
  visibility: 'private' | 'family'
  name: string
  icon: string
  color: string
  sort: number
  pendingCount: number
  createdAt: number
  updatedAt: number
}

export type ShoppingItem = {
  id: string
  listId: string
  name: string
  qty: number | null
  unit: string | null
  category: string
  note: string | null
  addedBy: string
  checked: boolean
  checkedBy: string | null
  checkedAt: number | null
  createdAt: number
  updatedAt: number
}

export type ShoppingSuggestion = { name: string; category: string; count: number }

export const createListInput = z.object({
  name: z.string().trim().min(1, '请输入清单名称').max(32),
  icon: z.string().max(32).default('shopping-cart'),
  color: colorSchema.default('#30d158'),
  visibility: visibilitySchema.default('family'),
})
export type CreateListInput = z.infer<typeof createListInput>

export const updateListInput = z.object({
  name: z.string().trim().min(1).max(32).optional(),
  icon: z.string().max(32).optional(),
  color: colorSchema.optional(),
  visibility: visibilitySchema.optional(),
  sort: z.number().int().optional(),
})
export type UpdateListInput = z.infer<typeof updateListInput>

export const addItemInput = z
  .object({
    text: z.string().trim().max(100).optional(),
    name: z.string().trim().max(64).optional(),
    qty: z.number().positive().max(100000).nullable().optional(),
    unit: z.string().trim().max(8).nullable().optional(),
    category: z.string().trim().max(16).optional(),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine((v) => Boolean(v.name || v.text), { message: '请输入商品名称' })
export type AddItemInput = z.infer<typeof addItemInput>

export const addItemsInput = z.union([addItemInput, z.array(addItemInput).min(1).max(100)])

export const updateItemInput = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  qty: z.number().positive().max(100000).nullable().optional(),
  unit: z.string().trim().max(8).nullable().optional(),
  category: z.string().trim().min(1).max(16).optional(),
  note: z.string().trim().max(200).nullable().optional(),
  checked: z.boolean().optional(),
})
export type UpdateItemInput = z.infer<typeof updateItemInput>
