// First run. Every step can be skipped, the position is saved, and it can be run again
// from Settings. By the time this appears the app already works: the Music folder is set.
import { ArrowRight, CheckCircle2, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/base/Layout"
import { folderName, openMusicFolder } from "@/lib/musicFolder"
import { canLoadData, useYoutubeAccess } from "@/components/youtube/accessStore"
import { DownloadPicker } from "@/components/youtube/DownloadPicker"
import { CookieSection, OtherOptions } from "@/components/youtube/YoutubeUnlock"
import { rescanLibrary, selectMusicFolder, updateSettings } from "@/lib/actions"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"

const STEPS = ["folder", "youtube", "pick"] as const
type Step = (typeof STEPS)[number]

function Shell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children?: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome" className="fixed inset-0 z-50 overflow-y-auto bg-background p-6">
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

function FolderStep() {
  const rootDir = useLibraryStore((s) => s.rootDir)
  const count = useLibraryStore((s) => s.songs.length)
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3 p-5">
        {rootDir ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-5 text-success" aria-hidden /> Your music lives in {folderName(rootDir)}
            </p>
            <p className="break-all text-sm text-muted-foreground">{rootDir}</p>
            <p className="text-sm">{count ? `Found ${count} ${count === 1 ? "song" : "songs"}.` : "No MP3s there yet, which is fine."}</p>
          </>
        ) : (
          <p className="font-medium">Choose where your music should live.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void selectMusicFolder()}>
            <FolderOpen /> {rootDir ? "Change folder" : "Choose folder"}
          </Button>
          {rootDir && (
            <>
              <Button variant="ghost" onClick={openMusicFolder}>
                Open it
              </Button>
              <Button variant="ghost" onClick={() => void rescanLibrary()}>
                Rescan
              </Button>
            </>
          )}
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">Only MP3 files directly in this folder are found, not ones in folders inside it.</p>
    </div>
  )
}

export function Onboarding() {
  const loaded = useUserStore((s) => s.loaded)
  const onboarding = useUserStore((s) => s.settings.onboarding)
  const unlocked = useYoutubeAccess((s) => canLoadData(s.access))
  if (!loaded || onboarding.status !== "pending") return null

  const step: Step = STEPS.includes(onboarding.step as Step) ? (onboarding.step as Step) : "folder"
  const go = (next: Step) => void updateSettings({ onboarding: { status: "pending", step: next } })
  const finish = () => void updateSettings({ onboarding: { status: "done", step: "folder" } })

  if (step === "folder")
    return (
      <Shell
        title="Welcome to b1tburn3r20"
        subtitle="We've used your computer's Music folder, so there's nothing you need to do here."
        footer={
          <>
            <Button variant="ghost" onClick={finish}>
              Skip setup
            </Button>
            <Button onClick={() => go("youtube")}>
              Next <ArrowRight />
            </Button>
          </>
        }
      >
        <FolderStep />
      </Shell>
    )

  if (step === "youtube")
    return (
      <Shell
        title="Add YouTube, if you'd like"
        subtitle="This is optional. Your library, radio and everything else work without it, and you can add it any time from the YouTube page."
        footer={
          <>
            <Button variant={unlocked ? "ghost" : "secondary"} onClick={finish}>
              {unlocked ? "Skip downloads" : "Skip, I'll just use my own music"}
            </Button>
            {unlocked && (
              <Button onClick={() => go("pick")}>
                Next <ArrowRight />
              </Button>
            )}
          </>
        }
      >
        <CookieSection onImported={() => go("pick")} />
        <OtherOptions browser={false} />
      </Shell>
    )

  return (
    <Shell title="What should come in?" subtitle="Tick what to download into your music folder. It happens in the background." footer={null}>
      <DownloadPicker onDone={finish} />
    </Shell>
  )
}
