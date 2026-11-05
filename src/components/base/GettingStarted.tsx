// What to do next, based on what's actually true right now. Local actions always come
// first, and YouTube is always presented as optional.
import { CheckCircle2, Circle, FolderOpen, RefreshCw, Youtube, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { canLoadData, canSearch, useYoutubeAccess } from "@/components/youtube/accessStore"
import { rescanLibrary, selectMusicFolder } from "@/lib/actions"
import { folderName, openMusicFolder } from "@/lib/musicFolder"
import { navigate } from "@/stores/useAppStore"
import { useLibraryStore } from "@/stores/useLibraryStore"

/** The actions that work for anyone with an empty library, for reuse in empty states. */
export function AddMusicActions({ youtube = true }: { youtube?: boolean }) {
  const rootDir = useLibraryStore((s) => s.rootDir)
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {rootDir ? (
        <>
          <Button onClick={openMusicFolder}>
            <FolderOpen /> Open music folder
          </Button>
          <Button variant="secondary" onClick={() => void rescanLibrary()}>
            <RefreshCw /> Rescan
          </Button>
        </>
      ) : (
        <Button onClick={() => void selectMusicFolder()}>
          <FolderOpen /> Choose a music folder
        </Button>
      )}
      {youtube && (
        <Button variant="ghost" onClick={() => navigate({ name: "youtube" })}>
          <Youtube /> Use YouTube
        </Button>
      )}
    </div>
  )
}

function ChecklistItem({ done, title, hint, children }: { done?: boolean; title: string; hint: string; children?: React.ReactNode }) {
  const Icon: LucideIcon = done ? CheckCircle2 : Circle
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-card p-4">
      <div className="flex items-start gap-3">
        <Icon className={done ? "mt-0.5 size-5 shrink-0 text-success" : "mt-0.5 size-5 shrink-0 text-muted-foreground"} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2 pl-8">{children}</div>}
    </li>
  )
}

/** The Home page for someone with no songs yet. */
export function GettingStarted() {
  const rootDir = useLibraryStore((s) => s.rootDir)
  const access = useYoutubeAccess((s) => s.access)
  const search = canSearch(access)
  const data = canLoadData(access)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Let's get some music in here</h1>
        <p className="text-muted-foreground">Everything in this app works from the music on your computer. YouTube is optional.</p>
      </div>
      <ul className="flex flex-col gap-3">
        <ChecklistItem
          title={rootDir ? `Add MP3s to your ${folderName(rootDir)} folder` : "Choose a music folder"}
          hint={rootDir ? `Put MP3 files directly in ${rootDir}, not in a folder inside it, then rescan.` : "This is where your music lives, and where downloads go."}
        >
          <AddMusicActions youtube={false} />
          {rootDir && (
            <Button size="sm" variant="ghost" onClick={() => void selectMusicFolder()}>
              Use a different folder
            </Button>
          )}
        </ChecklistItem>
        <ChecklistItem done={search} title="Optional: search YouTube" hint={search ? "Search is unlocked. Find a song and download it." : "Find songs on YouTube and download them. Needs a free API key from Google."}>
          <Button size="sm" variant="secondary" onClick={() => navigate({ name: "youtube" })}>
            <Youtube /> {search ? "Search YouTube" : "Set up search"}
          </Button>
        </ChecklistItem>
        <ChecklistItem done={data} title="Optional: load your YouTube data" hint={data ? "Connected. Your playlists and likes are ready to download." : "Bring in your playlists and likes by uploading a cookies.txt file."}>
          <Button size="sm" variant="secondary" onClick={() => navigate({ name: "youtube" })}>
            <Youtube /> {data ? "See your playlists" : "Set up"}
          </Button>
        </ChecklistItem>
      </ul>
    </div>
  )
}
