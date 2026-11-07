import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Modal } from "@/components/base/Modal"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { buildTagList } from "@/lib/catalog"
import { canonicalTag, GENRE_GROUPS, likelyTypoOf, looseKey, tagMatches } from "@/lib/tagPresets"
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
  // The misspelling-looking text you pressed Enter on: a second Enter means you meant it.
  const [typoSeen, setTypoSeen] = useState<string | null>(null)
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
    const have = new Set([...tags, ...partial.map((p) => p.name)].map(looseKey))
    return known.filter((t) => !have.has(looseKey(t.name)) && tagMatches(t.name, input))
  }, [known, tags, partial, input])
  // Standard genres you don't use yet (the ones you use are in "Your tags" above).
  const genres = useMemo(() => {
    const have = new Set([...tags, ...partial.map((p) => p.name), ...known.map((k) => k.name)].map(looseKey))
    return GENRE_GROUPS.map((g) => ({ label: g.label, genres: g.genres.filter((name) => !have.has(looseKey(name)) && tagMatches(name, input)) })).filter((g) => g.genres.length)
  }, [known, tags, partial, input])
  const ownNames = useMemo(() => known.map((k) => k.name), [known])
  // What Enter would add: the exact tag or genre, else the first of your tags starting with it.
  const canonicalInput = canonicalTag(input, ownNames)
  const isKnownName = looseKey(canonicalInput) !== looseKey(input) || ownNames.some((n) => looseKey(n) === looseKey(input)) || GENRE_GROUPS.some((g) => g.genres.some((n) => looseKey(n) === looseKey(input)))
  const enterTag = !input.trim() ? null : isKnownName ? canonicalInput : (suggestions.find((s) => s.key.startsWith(lc(input)))?.name ?? canonicalInput)

  const allNames = useMemo(() => [...ownNames, ...GENRE_GROUPS.flatMap((g) => g.genres)], [ownNames])
  const typoOf = input.trim() && !suggestions.some((s) => s.name === enterTag) ? likelyTypoOf(canonicalInput, allNames) : null
  const typoConfirmed = typoSeen === looseKey(input)
  /** Holds back a likely misspelling once, so it can't become a tag by accident. */
  const stopForTypo = () => {
    if (!typoOf || typoConfirmed) return false
    setTypoSeen(looseKey(input))
    return true
  }

  const add = (t: string) => {
    const v = canonicalTag(t, ownNames)
    setInput("")
    inputRef.current?.focus()
    if (!v || tags.some((x) => looseKey(x) === looseKey(v))) return
    setTags((cur) => [...cur, v])
    setPartial((p) => p.filter((x) => looseKey(x.name) !== looseKey(v)))
  }
  const close = () => dialogs().openTags(null)

  const save = async () => {
    if (!songs || stopForTypo()) return
    const final = input.trim() && !tags.some((t) => looseKey(t) === looseKey(canonicalInput)) ? [...tags, canonicalInput] : tags
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
      <div className="flex h-full flex-col gap-3">
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
                if (!stopForTypo()) add(enterTag ?? input)
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
        {typoOf ? (
          <p className={cn("text-xs", typoConfirmed ? "text-foreground" : "text-muted-foreground")}>
            Did you mean{" "}
            <button type="button" onClick={() => add(typoOf)} className="font-medium text-foreground underline">
              {typoOf}
            </button>
            ? {typoConfirmed ? `Press Enter again to create “${canonicalInput}” anyway.` : `Enter twice keeps “${canonicalInput}”.`}
          </p>
        ) : (
          input.trim() && !isKnownName && !suggestions.some((s) => s.name === enterTag) && <p className="text-xs text-muted-foreground">Enter creates a new tag “{canonicalInput}”.</p>
        )}
        {/* One scrolling list that fills the dialog, so the box you type in never moves. */}
        {(suggestions.length > 0 || genres.length > 0) && (
          <ScrollArea type="auto" className="min-h-40 flex-1 border-t border-border/60" aria-label="Tag options">
            <div className="flex flex-col gap-4 pt-3 pr-3 pb-1">
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Your tags</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => add(t.name)}
                        className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground", enterTag === t.name && "border-primary text-foreground")}
                      >
                        <Plus className="size-3" /> {t.name} <span className="text-xs opacity-60">{t.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {genres.map((g) => (
                <div key={g.label} className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.genres.map((name) => (
                      <button key={name} type="button" onClick={() => add(name)} className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground", enterTag === name && "border-primary text-foreground")}>
                        <Plus className="size-3" aria-hidden /> {name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Modal>
  )
}
