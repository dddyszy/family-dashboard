import { lazy, Suspense } from 'react'
import { useCalendarUi } from '../store'

const EventEditor = lazy(() => import('./event-editor').then((m) => ({ default: m.EventEditor })))
const TodoEditor = lazy(() => import('./todo-editor').then((m) => ({ default: m.TodoEditor })))

/** Mounted once in the app shell so any page, drawer or widget can open the editors. */
export function CalendarEditorHost() {
  const { editor, todoEditor, closeEditor, closeTodoEditor } = useCalendarUi()
  return (
    <Suspense fallback={null}>
      {editor ? (
        <EventEditor
          key={editor.kind === 'edit' ? editor.instance.key : `new-${editor.draft?.startAt ?? ''}`}
          target={editor}
          onClose={closeEditor}
        />
      ) : null}
      {todoEditor ? <TodoEditor target={todoEditor} onClose={closeTodoEditor} /> : null}
    </Suspense>
  )
}
