import { create } from 'zustand'

export type DrawerState = { name: string; props?: Record<string, unknown> } | null

type UiState = {
  drawer: DrawerState
  editMode: boolean
  galleryOpen: boolean
  openDrawer: (name: string, props?: Record<string, unknown>) => void
  closeDrawer: () => void
  setEditMode: (value: boolean) => void
  setGalleryOpen: (value: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  drawer: null,
  editMode: false,
  galleryOpen: false,
  openDrawer: (name, props) => set({ drawer: { name, props } }),
  closeDrawer: () => set({ drawer: null }),
  setEditMode: (value) => set({ editMode: value, galleryOpen: false }),
  setGalleryOpen: (value) => set({ galleryOpen: value }),
}))

export type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' }

type ToastState = {
  toasts: Toast[]
  push: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let toastId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = toastId++
    set({ toasts: [...get().toasts.slice(-3), { id, message, tone }] })
    setTimeout(() => get().dismiss(id), 3500)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = {
  info: (message: string) => useToasts.getState().push(message, 'info'),
  success: (message: string) => useToasts.getState().push(message, 'success'),
  error: (message: string) => useToasts.getState().push(message, 'error'),
}
