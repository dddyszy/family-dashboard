import type { Todo } from '@shared/schemas/todos'
import { create } from 'zustand'
import type { EditorTarget } from './components/event-editor'

export type TodoEditorTarget = { kind: 'new' } | { kind: 'edit'; todo: Todo }

type CalendarUi = {
  editor: EditorTarget | null
  todoEditor: TodoEditorTarget | null
  openEditor: (target: EditorTarget) => void
  closeEditor: () => void
  openTodoEditor: (target: TodoEditorTarget) => void
  closeTodoEditor: () => void
}

export const useCalendarUi = create<CalendarUi>((set) => ({
  editor: null,
  todoEditor: null,
  openEditor: (target) => set({ editor: target }),
  closeEditor: () => set({ editor: null }),
  openTodoEditor: (target) => set({ todoEditor: target }),
  closeTodoEditor: () => set({ todoEditor: null }),
}))
