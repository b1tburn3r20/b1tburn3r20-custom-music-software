import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ListMusic, Music, Search, Youtube } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SongRow } from "@/components/song/SongRow"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { navigate, useAppStore } from "@/stores/useAppStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useYoutubeStore } from "@/components/youtube/searchStore"
import { useYoutubeTab } from "@/components/youtube/tabStore"
import { searchSongs, shuffled } from "@/lib/catalog"
import { playRadio } from "@/player/controls"
import { cn } from "@/lib/utils"
import { ListButton } from "@/components/base/Layout"
import AppSettings from "./settings/SettingsDialog"

const YTM = "https://music.youtube.com"

function openYTMPopup(url: string) {
  const width = Math.min(window.screen.width * 0.85, 1200)
  const height = Math.min(window.screen.height * 0.85, 900)
  window.open(url, "ytmusic", `width=${width},height=${height},left=${(window.screen.width - width) / 2},top=${(window.screen.height - height) / 2},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`)
}

function searchYouTubeApi(q: string, playlists: boolean) {
  const yt = useYoutubeStore.getState()
  yt.setSearchTerm(q)
  yt.setPlaylists(playlists)
  yt.incrementTriggerSearchKey()
  useYoutubeTab.getState().setTab("search")
  navigate({ name: "youtube" })
}

type Action = { key: string; icon: LucideIcon; label: string; tag: string; run: (q: string) => void }
const ACTIONS: Action[] = [
  { key: "ytm-song", icon: Music, label: "Search songs", tag: "YouTube Music", run: (q) => openYTMPopup(`${YTM}/search?q=${encodeURIComponent(q)}`) },
  { key: "ytm-pl", icon: ListMusic, label: "Search playlists", tag: "YouTube Music", run: (q) => openYTMPopup(`${YTM}/search?q=${encodeURIComponent(q)}&params=EgeKAQQoAUICCAE%3D`) },
  { key: "api-video", icon: Youtube, label: "Search videos", tag: "YouTube", run: (q) => searchYouTubeApi(q, false) },
  { key: "api-pl", icon: ListMusic, label: "Search playlists", tag: "YouTube", run: (q) => searchYouTubeApi(q, true) },
]

function SearchBox() {
  const songs = useLibraryStore((s) => s.songs)
  const route = useAppStore((s) => s.route)
  const expanded = useSettingsStore((s) => s.playerExpanded)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const randomFive = useMemo(() => shuffled(songs).slice(0, 5), [songs.length, open])
  const suggestions = useMemo(() => (query.trim() ? searchSongs(songs, query, 5) : randomFive), [songs, query, randomFive])
  const actions = query.trim() ? ACTIONS : []
  const total = suggestions.length + actions.length

  useEffect(() => {
    setQuery(route.name === "search" ? route.q : "")
  }, [route])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !expanded) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [expanded])

  const done = () => {
    setOpen(false)
    setFocus(-1)
    inputRef.current?.blur()
  }
  const submit = () => {
    const q = query.trim()
    if (!q) return
    navigate({ name: "search", q })
    done()
  }
  const runIndex = (i: number) => {
    if (i < suggestions.length) {
      playRadio(suggestions[i])
      done()
    } else {
      actions[i - suggestions.length]?.run(query.trim())
      setQuery("")
      done()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setFocus((f) => (f + 1 >= total ? -1 : f + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocus((f) => (f <= -1 ? total - 1 : f - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (focus === -1) submit()
      else runIndex(focus)
    } else if (e.key === "Escape") {
      e.preventDefault()
      done()
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls="search-suggestions"
        aria-label="Search your library"
        className="pl-10"
        placeholder="Search…  (Ctrl+K)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setFocus(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div id="search-suggestions" role="listbox" className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          {suggestions.length > 0 && (
            <>
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{query.trim() ? "Songs" : "Try something"}</p>
              {suggestions.map((s, i) => (
                <SongRow key={s.id} song={s} variant="compact" onActivate={() => runIndex(i)} className={cn(focus === i && "ring-2 ring-primary/60")} />
              ))}
            </>
          )}
          {query.trim() && (
            <ListButton onClick={submit} className="mt-1">
              <Search className="size-4 text-muted-foreground" /> See all results for “{query.trim()}” <span className="ml-auto text-xs text-muted-foreground">Enter</span>
            </ListButton>
          )}
          {actions.length > 0 && <div className="my-1 h-px bg-border" />}
          {actions.map((a, j) => {
            const i = suggestions.length + j
            const Icon = a.icon
            return (
              <ListButton key={a.key} onClick={() => runIndex(i)} selected={focus === i}>
                <Icon className="size-4 text-destructive" aria-hidden />
                <span className="truncate">
                  {a.label} “{query.trim()}”
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{a.tag}</span>
              </ListButton>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const canBack = useAppStore((s) => s.back.length > 0)
  const canForward = useAppStore((s) => s.forward.length > 0)
  return (
    <div className="flex w-full items-center gap-2 p-4">
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" aria-label="Back" disabled={!canBack} onClick={() => useAppStore.getState().goBack()}>
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Forward" disabled={!canForward} onClick={() => useAppStore.getState().goForward()}>
          <ChevronRight />
        </Button>
      </div>
      <div className="mx-auto w-full max-w-xl">
        <SearchBox />
      </div>
      <AppSettings />
    </div>
  )
}
