import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/base/Modal"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { buildTagList } from "@/lib/catalog"
import { call, errorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const lc = (s: string) => s.trim().toLowerCase()

/**
 * Tag one or many songs. Type + Enter (or comma) adds a tag; click a suggestion
 * to add it; Backspace removes the last chip. With several songs, only your
 * additions/removals are applied — each song keeps its other tags.
 */
export default function TagsDialog() {
  const songs = useDialogStore((s) => s.tagSongs)
  const songTags = useUserStore((s) => s.songTags)
  const library = useLibraryStore((s) => s.songs)
  const [tags, setTags] = useState<string[]>([])
  const [initial, setInitial] = useState<string[]>([])
  const [partial, setPartial] = useState<{ name: string; n: number }[]>([])
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const multi = (songs?.length ?? 0) > 1

  useEffect(() => {
    if (!songs?.length) return
    const lists = songs.map((s) => songTags[s.id] ?? [])
    const common = lists[0].filter((t) => lists.every((l) => l.some((x) => lc(x) === lc(t))))
    const counts = new Map<string, { name: string; n: number }>()
    for (const l of lists) for (const t of l) if (!common.some((c) => lc(c) === lc(t))) counts.set(lc(t), { name: t, n: (counts.get(lc(t))?.n ?? 0) + 1 })
    setTags(common)
    setInitial(common)
    setPartial([...counts.values()].sort((a, b) => b.n - a.n))
    setInput("")
    // only when the dialog opens for new songs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs])

  const known = useMemo(() => buildTagList(library, songTags).filter((t) => t.own), [library, songTags])
  const suggestions = useMemo(() => {
    const have = new Set([...tags, ...partial.map((p) => p.name)].map(lc))
    const q = lc(input)
    return known.filter((t) => !have.has(t.key) && (!q || t.key.includes(q))).slice(0, 16)
  }, [known, tags, partial, input])

  const add = (t: string) => {
    const v = t.trim().replace(/\s+/g, " ")
    setInput("")
    inputRef.current?.focus()
    if (!v || tags.some((x) => lc(x) === lc(v))) return
    const existing = known.find((k) => k.key === lc(v))
    setTags((cur) => [...cur, existing ? existing.name : v])
    setPartial((p) => p.filter((x) => lc(x.name) !== lc(v)))
  }
  const close = () => dialogs().openTags(null)

  const save = async () => {
    if (!songs) return
    const final = input.trim() ? [...tags, input.trim()] : tags
    const ids = songs.map((s) => s.id)
    setSaving(true)
    try {
      if (!multi) await call(window.api.user.setSongTags(ids, final))
      else {
        const added = final.filter((t) => !initial.some((i) => lc(i) === lc(t)))
        const removed = initial.filter((i) => !final.some((t) => lc(t) === lc(i)))
        for (const t of added) await call(window.api.user.changeTag(ids, t, true))
        for (const t of removed) await call(window.api.user.changeTag(ids, t, false))
        if (added.length || removed.length) toast.success(`Updated tags on ${ids.length} songs`)
      }
      close()
    } catch (err) {
      toast.error("Couldn't save tags", { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const title = multi ? `Tag ${songs?.length} songs` : `Tags for “${songs?.[0]?.metadata.title ?? ""}”`
  const genre = !multi ? songs?.[0]?.metadata.genre : null
  return (
    <Modal
      open={Boolean(songs)}
      onClose={close}
      title={title}
      description={multi ? "Tags you add here go on every selected song; removing a tag takes it off all of them. Other tags stay." : "Tag with a mood or genre (somber, rap, rock…). Radio plays songs that share tags first."}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted-foreground">Enter adds · Ctrl+Enter saves</span>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input p-2" onClick={() => inputRef.current?.focus()}>
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-sm text-foreground">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-primary/20">
                <X className="size-3" />
              </button>
            </span>
          ))}
          <Input
            ref={inputRef}
            autoFocus
            value={input}
            maxLength={32}
            onChange={(e) => setInput(e.target.value.replace(",", ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void save()
              } else if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                if (!input.trim()) {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void save()
                  }
                  return
                }
                e.preventDefault()
                // Enter on a partial word picks the first matching existing tag
                add(suggestions.find((s) => s.key.startsWith(lc(input)))?.name ?? input)
              } else if (e.key === "Backspace" && !input && tags.length) setTags(tags.slice(0, -1))
            }}
            placeholder={tags.length ? "Add another…" : "Type a tag, Enter to add"}
            aria-label="New tag"
            className="h-7 min-w-40 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        {genre && <p className="text-xs text-muted-foreground">The file's genre “{genre}” is also used for mixing.</p>}
        {partial.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">On some of the selected songs — click to add to all:</p>
            <div className="flex flex-wrap gap-2">
              {partial.map((p) => (
                <button key={p.name} type="button" onClick={() => add(p.name)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                  <Plus className="size-3" /> {p.name} <span className="text-xs opacity-60">{p.n}/{songs?.length}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Your tags">
            {suggestions.map((t, i) => (
              <button
                key={t.key}
                type="button"
                onClick={() => add(t.name)}
                className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground", input && i === 0 && "border-primary text-foreground")}
              >
                <Plus className="size-3" /> {t.name} <span className="text-xs opacity-60">{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
