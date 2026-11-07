// First run: one quick screen to connect YouTube, then what to download if there's an account
// to download from. It can be skipped, and run again from Settings. The app already works by
// the time this appears, because the Music folder is set.
import { ArrowRight, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { canLoadData, useYoutubeAccess } from "@/components/youtube/accessStore"
import { DownloadPicker } from "@/components/youtube/DownloadPicker"
import { CookieSection, OtherOptions, SearchOption } from "@/components/youtube/YoutubeUnlock"
import { selectMusicFolder, updateSettings } from "@/lib/actions"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"

function Shell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children?: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Setup" className="fixed inset-0 z-50 overflow-y-auto bg-background p-6">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-6">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
        <div className="flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  )
}

function MusicFolderLine() {
  const rootDir = useLibraryStore((s) => s.rootDir)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p className="min-w-0 break-all">{rootDir ? <>Music is saved to {rootDir}</> : "Choose where to save your music."}</p>
      <Button variant="ghost" size="sm" onClick={() => void selectMusicFolder()}>
        <FolderOpen /> {rootDir ? "Change" : "Choose folder"}
      </Button>
    </div>
  )
}

export function Onboarding() {
  const loaded = useUserStore((s) => s.loaded)
  const onboarding = useUserStore((s) => s.settings.onboarding)
  const unlocked = useYoutubeAccess((s) => canLoadData(s.access))
  if (!loaded || onboarding.status !== "pending") return null

  const pick = () => void updateSettings({ onboarding: { status: "pending", step: "pick" } })
  const finish = () => void updateSettings({ onboarding: { status: "done", step: "folder" } })

  if (onboarding.step === "pick")
    return (
      <Shell title="What should come in?" subtitle="Tick what to download into your music folder. It happens in the background." footer={null}>
        <DownloadPicker onDone={finish} />
      </Shell>
    )

  return (
    <Shell
      title="Quick setup"
      subtitle="Upload your cookies or add an API key, and you're ready to go."
      footer={
        <>
          <Button variant={unlocked ? "ghost" : "secondary"} onClick={finish}>
            Skip setup
          </Button>
          {unlocked && (
            <Button onClick={pick}>
              Next <ArrowRight />
            </Button>
          )}
        </>
      }
    >
      <CookieSection onImported={pick} />
      <div className="flex">
        <SearchOption onSaved={finish} />
      </div>
      <OtherOptions browser={false} search={false} />
      <MusicFolderLine />
    </Shell>
  )
}
