// What the YouTube page shows until something is set up: cookies.txt first, the rest as extras.
import { useState } from "react"
import { KeyRound, ListMusic, Search, Settings, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, Heading } from "@/components/base/Layout"
import { openSettings } from "@/app/settings/settingsStore"
import { ApiKeyDialog } from "./ApiKeySetup"
import { CookieUpload } from "./CookieUpload"
import { GoogleSetupDialog } from "./GoogleSetup"
import { useYoutubeTab } from "./tabStore"

function OptionCard({ icon: Icon, title, gives, needs, action }: { icon: typeof Search; title: string; gives: string; needs: string; action: React.ReactNode }) {
  return (
    <Card className="flex min-w-64 flex-1 flex-col gap-2 p-4">
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      <Heading level={3}>{title}</Heading>
      <p className="flex-1 text-sm">{gives}</p>
      <p className="text-xs text-muted-foreground">{needs}</p>
      {action}
    </Card>
  )
}

export function SearchOption() {
  const [open, setOpen] = useState(false)
  return (
    <OptionCard
      icon={Search}
      title="Search YouTube"
      gives="Find songs, playlists and links on YouTube, and download them into your library."
      needs="Needs a free API key from Google. Takes a few minutes, once."
      action={
        <>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <KeyRound /> Add API key
          </Button>
          <ApiKeyDialog open={open} onClose={() => setOpen(false)} />
        </>
      }
    />
  )
}

export function GoogleOption() {
  const [open, setOpen] = useState(false)
  return (
    <OptionCard
      icon={UserCheck}
      title="Sign in with your own Google client"
      gives="Read-only access to your playlists, liked videos and subscriptions, with no cookies."
      needs="Needs your own Google Cloud project. Takes about ten minutes, once."
      action={
        <>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <UserCheck /> Connect Google
          </Button>
          <GoogleSetupDialog open={open} onClose={() => setOpen(false)} />
        </>
      }
    />
  )
}

/** The cookies.txt upload, as the main thing on a page or tab. */
export function CookieSection({ onImported }: { onImported?: () => void }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <Heading level={3}>Connect your YouTube account</Heading>
        <p className="text-sm text-muted-foreground">Upload a cookies.txt file in Netscape format to load your playlists and liked videos, and to download anything your account can watch.</p>
      </div>
      <CookieUpload onImported={onImported} />
    </Card>
  )
}

/** The other ways in, tucked away so the main way stays simple. */
export function OtherOptions({ browser = true }: { browser?: boolean }) {
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">Other options</summary>
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          <SearchOption />
          <GoogleOption />
        </div>
        {browser && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => openSettings("youtube")}>
            <Settings /> Use your browser's sign-in instead of a file
          </Button>
        )}
      </div>
    </details>
  )
}

/** Nothing unlocked yet. YouTube is optional, and the page says so. */
export function YoutubeUnlock() {
  const setTab = useYoutubeTab((s) => s.setTab)
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ListMusic className="size-4 shrink-0" aria-hidden /> YouTube is optional. Your library, radio and everything else work without it.
      </p>
      <CookieSection onImported={() => setTab("mine")} />
      <OtherOptions />
    </div>
  )
}
