import LaxPlayer from "@/components/LaxPlayer"
import LaxPlayerNextUp from "@/components/Music/LaxPlayerNextUp"
import MusicPlayer from "@/components/MusicPlayer/MusicPlayer"
import { ScrollArea } from "@/components/ui/scroll-area"
import DeleteSongDialog from "@/components/dialogs/DeleteSongDialog"
import AddToPlaylistDialog from "@/components/dialogs/AddToPlaylistDialog"
import PlaylistFormDialog from "@/components/dialogs/PlaylistFormDialog"
import DeletePlaylistDialog from "@/components/dialogs/DeletePlaylistDialog"
import TagsDialog from "@/components/dialogs/TagsDialog"
import { SelectionBar } from "@/components/song/SelectionBar"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { useAppStore } from "@/stores/useAppStore"
import { useEffect, useRef, useState } from "react"
import { ScrollParentContext } from "./scrollContext"
import { ErrorBoundary } from "./ErrorBoundary"
import { navigate } from "@/stores/useAppStore"
import { useThemeSync } from "./theme"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import Router from "./Router"

export default function AppShell() {
  const route = useAppStore((s) => s.route)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setViewport(scrollRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? null)
  }, [])
  useThemeSync()
  // New page → start at the top.
  useEffect(() => {
    viewport?.scrollTo({ top: 0 })
    useSelectionStore.getState().clear()
  }, [route, viewport])
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden">
      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative flex min-w-0 w-full flex-col">
          <TopBar />
          <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
            <ScrollParentContext.Provider value={viewport}>
              <ErrorBoundary key={JSON.stringify(route)} label="page" onHome={() => navigate({ name: "home" })}>
                <Router />
              </ErrorBoundary>
            </ScrollParentContext.Provider>
          </ScrollArea>
          <SelectionBar />
        </main>
      </div>
      <div className="relative z-30 shrink-0">
        <ErrorBoundary label="player">
          <MusicPlayer />
        </ErrorBoundary>
      </div>
      <ErrorBoundary label="zen player">
        <LaxPlayer />
      </ErrorBoundary>
      <LaxPlayerNextUp />
      <DeleteSongDialog />
      <AddToPlaylistDialog />
      <PlaylistFormDialog />
      <DeletePlaylistDialog />
      <TagsDialog />
    </div>
  )
}
