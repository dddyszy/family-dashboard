import { Plus } from 'lucide-react'
import { type ClipboardEvent, type FormEvent, useDeferredValue, useState } from 'react'
import { Button } from '@/components/button'
import { Input } from '@/components/form'
import { useAddItems, useFrequent, useSuggestions } from '../queries'

export function AddItemBar({
  listId,
  showFrequent = true,
}: {
  listId: string
  showFrequent?: boolean
}) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const deferred = useDeferredValue(text)
  const suggestions = useSuggestions(deferred)
  const frequent = useFrequent(showFrequent)
  const add = useAddItems(listId)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const value = text.trim()
    if (!value) return
    add.mutate([{ text: value }])
    setText('')
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    const lines = pasted
      .split(/\r?\n|[，,、；;]/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length > 1) {
      e.preventDefault()
      add.mutate(lines.map((line) => ({ text: line })))
    }
  }

  const matches = (suggestions.data ?? []).filter((s) => s.name !== text.trim())

  return (
    <div className="flex flex-col gap-2">
      <form className="relative flex gap-2" onSubmit={submit}>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="添加商品，例如：鸡蛋 2盒（可粘贴多行）"
          enterKeyHint="done"
          aria-label="添加商品"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          aria-label="添加"
          disabled={!text.trim()}
        >
          <Plus className="size-5" />
        </Button>
        {focused && matches.length > 0 ? (
          <ul className="glass glass-strong absolute top-12 right-12 left-0 z-20 overflow-hidden rounded-2xl py-1 animate-pop-in">
            {matches.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-surface"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    add.mutate([{ name: s.name, category: s.category }])
                    setText('')
                  }}
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-fg-subtle">
                    {s.category} · 买过 {s.count} 次
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      {showFrequent && frequent.data?.length ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="shrink-0 self-center text-xs text-fg-subtle">常买</span>
          {frequent.data.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => add.mutate([{ name: s.name, category: s.category }])}
              className="pressable shrink-0 rounded-full bg-surface px-3 py-1 text-sm text-fg-muted hover:text-fg"
            >
              + {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
