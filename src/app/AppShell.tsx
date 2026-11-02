import LaxPlayer from "@/components/LaxPlayer"
import LaxPlayerNextUp from "@/components/Music/LaxPlayerNextUp"
import MusicPlayer from "@/components/MusicPlayer/MusicPlayer"
import { ScrollArea } from "@/components/ui/scroll-area"
import DeleteSongDialog from "@/components/dialogs/DeleteSongDialog"
import AddToPlaylistDialog from "@/components/dialogs/AddToPlaylistDialog"
import PlaylistFormDialog from "@/components/dialogs/PlaylistFormDialog"
import DeletePlaylistDialog from "@/components/dialogs/DeletePlaylistDialog"
import { useAppStore } from "@/stores/useAppStore"
import { useEffect, useRef } from "react"
import { useThemeSync } from "./theme"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import Router from "./Router"

export default function AppShell() {
  const route = useAppStore((s) => s.route)
  const scrollRef = useRef<HTMLDivElement>(null)
  useThemeSync()
  // New page → start at the top.
  useEffect(() => {
    scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]")?.scrollTo({ top: 0 })
  }, [route])
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden">
      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 w-full flex-col">
          <TopBar />
          <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
            <Router />
          </ScrollArea>
        </main>
      </div>
      <div className="relative z-30 shrink-0">
        <MusicPlayer />
      </div>
      <LaxPlayer />
      <LaxPlayerNextUp />
      <DeleteSongDialog />
      <AddToPlaylistDialog />
      <PlaylistFormDialog />
      <DeletePlaylistDialog />
    </div>
  )
}
