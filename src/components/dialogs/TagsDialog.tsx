import { useEffect, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/base/Modal"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { buildTagList } from "@/lib/catalog"
import { setSongTags } from "@/lib/actions"
import { cn } from "@/lib/utils"

const lc = (s: string) => s.trim().toLowerCase()

/** Edit your own tags (mood/genre) for a song. Existing tags are suggested so spellings stay consistent. */
export default function TagsDialog() {
  const songs = useDialogStore((s) => s.tagSongs)
  const songTags = useUserStore((s) => s.songTags)
  const library = useLibraryStore((s) => s.songs)
  const [tags, setTags] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!songs?.length) return
    // Several songs: start from the tags they all share.
    const lists = songs.map((s) => songTags[s.id] ?? [])
    setTags(lists[0].filter((t) => lists.every((l) => l.some((x) => lc(x) === lc(t)))))
    setInput("")
    // only when the dialog opens for new songs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs])

  const known = useMemo(() => buildTagList(library, songTags).filter((t) => t.own), [library, songTags])
  const suggestions = useMemo(() => {
    const have = new Set(tags.map(lc))
    const q = lc(input)
    return known.filter((t) => !have.has(t.key) && (!q || t.key.includes(q))).slice(0, 12)
  }, [known, tags, input])

  const add = (t: string) => {
    const v = t.trim().replace(/\s+/g, " ")
    if (!v || tags.some((x) => lc(x) === lc(v))) return setInput("")
    const existing = known.find((k) => k.key === lc(v))
    setTags([...tags, existing ? existing.name : v])
    setInput("")
  }
  const close = () => dialogs().openTags(null)
  const save = async () => {
    if (!songs) return
    setSaving(true)
    const pending = input.trim() ? [...tags, input.trim()] : tags
    const ok = await setSongTags(songs.map((s) => s.id), pending)
    setSaving(false)
    if (ok) close()
  }

  const title = songs?.length === 1 ? `Tags for “${songs[0].metadata.title}”` : `Tags for ${songs?.length ?? 0} songs`
  const genre = songs?.length === 1 ? songs[0].metadata.genre : null
  return (
    <Modal
      open={Boolean(songs)}
      onClose={close}
      title={title}
      description="Tag songs with a mood or genre (e.g. somber, rap, rock). Radio mixes songs that share tags, even across artists."
      footer={
        <>
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
        <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input p-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-sm text-foreground">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-primary/20">
                <X className="size-3" />
              </button>
            </span>
          ))}
          <Input
            autoFocus
            value={input}
            maxLength={32}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                if (input.trim()) add(input)
                else void save()
              } else if (e.key === "Backspace" && !input && tags.length) setTags(tags.slice(0, -1))
            }}
            placeholder={tags.length ? "Add another…" : "Type a tag and press Enter"}
            aria-label="New tag"
            className="h-7 min-w-40 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        {genre && <p className="text-xs text-muted-foreground">The file's genre tag “{genre}” is also used for mixing.</p>}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((t) => (
              <button key={t.key} type="button" onClick={() => add(t.name)} className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground")}>
                <Plus className="size-3" /> {t.name} <span className="text-xs opacity-60">{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
