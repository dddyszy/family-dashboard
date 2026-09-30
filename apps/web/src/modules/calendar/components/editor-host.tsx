import { useCalendarUi } from '../store'
import { EventEditor } from './event-editor'
import { TodoEditor } from './todo-editor'

/** Mounted once in the app shell so any page, drawer or widget can open the editors. */
export function CalendarEditorHost() {
  const { editor, todoEditor, closeEditor, closeTodoEditor } = useCalendarUi()
  return (
    <>
      {editor ? (
        <EventEditor
          key={editor.kind === 'edit' ? editor.instance.key : `new-${editor.draft?.startAt ?? ''}`}
          target={editor}
          onClose={closeEditor}
        />
      ) : null}
      {todoEditor ? <TodoEditor target={todoEditor} onClose={closeTodoEditor} /> : null}
    </>
  )
}
