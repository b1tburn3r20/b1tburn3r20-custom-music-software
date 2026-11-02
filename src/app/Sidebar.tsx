import { Heart, Home, Library, ListMusic, ListPlus, Pencil, Play, Shuffle, Trash2, Youtube, History } from "lucide-react"
import { memo } from "react"
import type { LucideIcon } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DiceButton } from "@/components/cards/DiceButton"
import { Artwork } from "@/components/base/Artwork"
import { MenuEntries, type MenuEntry } from "@/components/song/menu"
import LottieViewer from "@/components/helpers/lottie-viewer"
import { navigate, useAppStore, type Route } from "@/stores/useAppStore"
import { useUserStore } from "@/stores/useUserStore"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { dialogs } from "@/stores/useDialogStore"
import { playContext, playShuffled } from "@/player/controls"
import type { Playlist } from "@/types/api"
import { cn } from "@/lib/utils"

function NavButton({ icon: Icon, label, route, active }: { icon: LucideIcon; label: string; route: Route; active: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-current={active ? "page" : undefined}
          onClick={() => navigate(route)}
          className={cn("flex size-12 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground")}
        >
          <Icon className="size-6" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

const SidebarPlaylist = memo(function SidebarPlaylist({ playlist, active }: { playlist: Playlist; active: boolean }) {
  const cover = useLibraryStore((s) => s.songsById[playlist.songIds[0]]?.metadata.thumbnail ?? null)
  const isPlaying = usePlayerStore((s) => s.queue.context?.type === "playlist" && s.queue.context.id === playlist.id && !s.paused)
  const ctx = { type: "playlist" as const, id: playlist.id, label: playlist.name }
  const entries: MenuEntry[] = [
    ...(playlist.songIds.length
      ? ([
          { kind: "item", key: "play", label: "Play", icon: Play, onSelect: () => playContext(resolveSongs(playlist.songIds), 0, ctx) },
          { kind: "item", key: "shuffle", label: "Shuffle", icon: Shuffle, onSelect: () => playShuffled(resolveSongs(playlist.songIds), ctx) },
          { kind: "separator", key: "s" },
        ] as MenuEntry[])
      : []),
    { kind: "item", key: "edit", label: "Rename / edit…", icon: Pencil, onSelect: () => dialogs().openPlaylistForm({ mode: "edit", playlistId: playlist.id }) },
    { kind: "item", key: "del", label: "Delete playlist…", icon: Trash2, destructive: true, onSelect: () => dialogs().confirmDeletePlaylist(playlist.id) },
  ]
  return (
    <ContextMenu>
      <Tooltip>
        <ContextMenuTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${playlist.name}, ${playlist.songIds.length} songs`}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate({ name: "playlist", id: playlist.id })}
              className={cn("relative size-12 shrink-0 rounded-md outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring", active && "ring-2 ring-primary")}
            >
              {cover ? <Artwork src={cover} size="fill" className="rounded-md" /> : <span className="flex size-full items-center justify-center rounded-md bg-muted text-muted-foreground"><ListMusic className="size-6" /></span>}
              {isPlaying && <span className="absolute inset-0 rounded-md bg-background/40"><LottieViewer /></span>}
            </button>
          </TooltipTrigger>
        </ContextMenuTrigger>
        <TooltipContent side="right">
          <p className="font-semibold">{playlist.name}</p>
          <p className="text-xs opacity-80">
            {playlist.songIds.length} {playlist.songIds.length === 1 ? "song" : "songs"} · right-click for options
          </p>
        </TooltipContent>
      </Tooltip>
      <ContextMenuContent className="w-52">
        <MenuEntries entries={entries} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
})

export default function Sidebar() {
  const route = useAppStore((s) => s.route)
  const playlists = useUserStore((s) => s.playlists)
  return (
    <TooltipProvider delayDuration={200}>
      <nav aria-label="Main" className="flex w-fit flex-col border-r border-border/40 px-4 py-4">
        <div className="flex flex-col gap-2">
          <NavButton icon={Home} label="Home" route={{ name: "home" }} active={route.name === "home"} />
          <NavButton icon={Library} label="Library" route={{ name: "library" }} active={route.name === "library"} />
          <NavButton icon={Youtube} label="YouTube" route={{ name: "youtube" }} active={route.name === "youtube"} />
          <NavButton icon={History} label="History" route={{ name: "history" }} active={route.name === "history"} />
        </div>
        <Separator className="my-4" />
        <div className="flex flex-col gap-2">
          <div className="size-12"><DiceButton kind="song" size="small" /></div>
          <div className="size-12"><DiceButton kind="playlist" size="small" /></div>
          <NavButton icon={Heart} label="Liked Songs" route={{ name: "liked" }} active={route.name === "liked"} />
        </div>
        <Separator className="my-4" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="New playlist" onClick={() => dialogs().openPlaylistForm({ mode: "create" })} className="mb-2 flex size-12 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground outline-none hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <ListPlus className="size-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">New playlist</TooltipContent>
        </Tooltip>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 p-0.5">
            {playlists.map((p) => (
              <SidebarPlaylist key={p.id} playlist={p} active={route.name === "playlist" && route.id === p.id} />
            ))}
          </div>
        </ScrollArea>
      </nav>
    </TooltipProvider>
  )
}
