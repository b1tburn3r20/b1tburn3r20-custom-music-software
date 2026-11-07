import LaxPlayer from "@/components/LaxPlayer"
import LaxPlayerNextUp from "@/components/Music/LaxPlayerNextUp"
import MusicPlayer from "@/components/MusicPlayer/MusicPlayer"
import { ScrollArea } from "@/components/ui/scroll-area"
import DeleteSongDialog from "@/components/dialogs/DeleteSongDialog"
import AddToPlaylistDialog from "@/components/dialogs/AddToPlaylistDialog"
import PlaylistFormDialog from "@/components/dialogs/PlaylistFormDialog"
import DeletePlaylistDialog from "@/components/dialogs/DeletePlaylistDialog"
import TagsDialog from "@/components/dialogs/TagsDialog"
import EqualizerDialog from "@/components/dialogs/EqualizerDialog"
import ShortcutsDialog from "@/components/dialogs/ShortcutsDialog"
import ZenSearchDialog from "@/components/dialogs/ZenSearchDialog"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { SelectionBar } from "@/components/song/SelectionBar"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { useAppStore } from "@/stores/useAppStore"
import { useEffect, useRef, useState } from "react"
import { ErrorBoundary } from "./ErrorBoundary"
import { navigate } from "@/stores/useAppStore"
import { ThemeWrapper } from "./ThemeWrapper"
import { TopProgress } from "@/components/base/TopProgress"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import { TitleBar } from "./TitleBar"
import Router from "./Router"
import { YtDlpUpdateBanner } from "@/components/youtube/YtDlpUpdate"
import { Onboarding } from "./onboarding/Onboarding"
import { useUserStore } from "@/stores/useUserStore"

export default function AppShell() {
  const route = useAppStore((s) => s.route)
  // While the full-screen player covers the app, keep Tab out of what is behind it.
  const expanded = useSettingsStore((s) => s.playerExpanded)
  const onboarding = useUserStore((s) => s.loaded && s.settings.onboarding.status === "pending")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setViewport(scrollRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? null)
  }, [])
  // New page → start at the top.
  useEffect(() => {
    viewport?.scrollTo({ top: 0 })
    useSelectionStore.getState().clear()
  }, [route, viewport])
  return (
    <ThemeWrapper>
    <div className="flex h-screen w-screen flex-col overflow-clip">
      <TitleBar />
      {/* Everything else, the full-screen player and setup included, stays below the title bar. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-clip">
      <TopProgress />
      <Onboarding />
      <div className="relative flex min-h-0 flex-1" inert={expanded || onboarding}>
        <Sidebar />
        <main className="relative flex min-w-0 w-full flex-col">
          <TopBar />
          <YtDlpUpdateBanner />
          <ScrollArea ref={scrollRef} className="min-h-0 flex-1" data-region="main" aria-label="Page">
            <ErrorBoundary key={JSON.stringify(route)} label="page" onHome={() => navigate({ name: "home" })}>
              <Router />
            </ErrorBoundary>
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
      <EqualizerDialog />
      <ShortcutsDialog />
      <ZenSearchDialog />
      </div>
    </div>
    </ThemeWrapper>
  )
}
