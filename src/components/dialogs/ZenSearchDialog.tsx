import { useEffect, useMemo, useRef, useState } from "react"
import { Mic2, Search } from "lucide-react"
import { Artwork } from "@/components/base/Artwork"
import { ListButton } from "@/components/base/Layout"
import { SongRow } from "@/components/song/SongRow"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SEARCH_ACTIONS, useLibrarySearch } from "@/app/librarySearch"
import { playRadio } from "@/player/controls"
import { navigate } from "@/stores/useAppStore"
import { useDialogStore } from "@/stores/useDialogStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { cn } from "@/lib/utils"

const LIMITS = { artists: 3, albums: 3, songs: 8 }
const close = () => useDialogStore.getState().openZenSearch(false)
/** Leaving the full-screen player, for results that open a page. */
const leavePlayer = () => useSettingsStore.getState().setPlayerExpanded(false)

function ZenSearch() {
  const [query, setQuery] = useState("")
  const [focus, setFocus] = useState(-1)
  const { q, artistHits, albumHits, songHits } = useLibrarySearch(query, LIMITS)
  const listRef = useRef<HTMLDivElement>(null)

  // Songs lead: they play right here, so Enter keeps you in the player.
  const items = useMemo(() => {
    const seeAll = q ? [{ kind: "all" as const }] : []
    const actions = q ? SEARCH_ACTIONS.map((action) => ({ kind: "action" as const, action })) : []
    return [
      ...songHits.map((song) => ({ kind: "song" as const, song })),
      ...albumHits.map((album) => ({ kind: "album" as const, album })),
      ...artistHits.map((artist) => ({ kind: "artist" as const, artist })),
      ...seeAll,
      ...actions,
    ]
  }, [q, songHits, albumHits, artistHits])
  const firstOf = (kind: (typeof items)[number]["kind"]) => items.findIndex((it) => it.kind === kind)

  useEffect(() => {
    listRef.current?.querySelector(`[data-result="${focus}"]`)?.scrollIntoView({ block: "nearest" })
  }, [focus])

  const run = (i: number) => {
    const it = items[i]
    if (!it) return
    close()
    if (it.kind === "song") return playRadio(it.song)
    if (it.kind === "action") {
      if (it.action.opensPage) leavePlayer()
      return it.action.run(q)
    }
    leavePlayer()
    if (it.kind === "album") navigate({ name: "album", key: it.album.key })
    else if (it.kind === "artist") navigate({ name: "artist", artist: it.artist.name })
    else navigate({ name: "search", q })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocus((f) => (f + 1 >= items.length ? 0 : f + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocus((f) => (f <= 0 ? items.length - 1 : f - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      run(focus)
    }
  }

  const heading = (text: string) => <p className="px-2 pb-1 pt-3 text-xs font-medium text-muted-foreground first:pt-0">{text}</p>
  const nothing = q && !songHits.length && !albumHits.length && !artistHits.length
  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          role="combobox"
          aria-expanded
          aria-controls="zen-search-results"
          aria-label="Search your library"
          className="h-12 pl-11 text-base"
          placeholder="Search your library…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setFocus(e.target.value.trim() ? 0 : -1)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {/* A fixed height, so the box doesn't jump around as results change. */}
      <div ref={listRef} id="zen-search-results" role="listbox" className="h-[min(60vh,28rem)] overflow-y-auto">
        {songHits.length > 0 && heading(q ? "Songs" : "Try something")}
        {songHits.map((s) => {
          const i = items.findIndex((it) => it.kind === "song" && it.song === s)
          return (
            <div key={s.id} data-result={i}>
              <SongRow song={s} variant="compact" onActivate={() => run(i)} className={cn(focus === i && "ring-2 ring-primary/60")} />
            </div>
          )
        })}
        {albumHits.length > 0 && heading("Albums")}
        {albumHits.map((a) => {
          const i = items.findIndex((it) => it.kind === "album" && it.album === a)
          return (
            <ListButton key={a.key} data-result={i} role="option" aria-selected={focus === i} selected={focus === i} onClick={() => run(i)}>
              <Artwork src={a.album_thumbnail} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.album_name}</span>
                <span className="block truncate text-xs text-muted-foreground">Album · {a.album_artists.length >= 5 ? "Various artists" : a.album_artists.join(", ")}</span>
              </span>
            </ListButton>
          )
        })}
        {artistHits.length > 0 && heading("Artists")}
        {artistHits.map((a) => {
          const i = items.findIndex((it) => it.kind === "artist" && it.artist === a)
          return (
            <ListButton key={a.key} data-result={i} role="option" aria-selected={focus === i} selected={focus === i} onClick={() => run(i)}>
              {a.thumbnail ? <Artwork src={a.thumbnail} size="sm" className="rounded-full" /> : <span className="flex size-art-sm items-center justify-center rounded-full bg-muted"><Mic2 className="size-4 text-muted-foreground" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block text-xs text-muted-foreground">Artist · {a.songCount} {a.songCount === 1 ? "song" : "songs"}</span>
              </span>
            </ListButton>
          )
        })}
        {nothing && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing in your library matches “{q}”.</p>}
        {q && (
          <>
            <div className="my-2 h-px bg-border" />
            <ListButton data-result={firstOf("all")} selected={focus === firstOf("all")} onClick={() => run(firstOf("all"))}>
              <Search className="size-4 text-muted-foreground" aria-hidden /> See all results for “{q}”
            </ListButton>
            {SEARCH_ACTIONS.map((action) => {
              const i = items.findIndex((it) => it.kind === "action" && it.action === action)
              const Icon = action.icon
              return (
                <ListButton key={action.key} data-result={i} selected={focus === i} onClick={() => run(i)}>
                  <Icon className="size-4 text-destructive" aria-hidden />
                  <span className="truncate">{action.label} “{q}”</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{action.tag}</span>
                </ListButton>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}

/** Ctrl+K in the full-screen player: search in the foreground, without leaving it. */
export default function ZenSearchDialog() {
  const open = useDialogStore((s) => s.zenSearchOpen)
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="gap-3 p-3 sm:max-w-2xl">
        <DialogTitle className="sr-only">Search your library</DialogTitle>
        <ZenSearch />
      </DialogContent>
    </Dialog>
  )
}
