import { AlertTriangle, FileUp, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { openSettings } from "@/app/settings/settingsStore"
import { UpdateYtDlpButton } from "./YtDlpUpdate"
import { chooseCookiesFile } from "./cookieFile"
import { errorMessage } from "@/lib/api"
import { toast } from "sonner"

/** Problems a new cookies file fixes, so the fix is right here and not a trip to Settings. */
const NEEDS_NEW_FILE = new Set(["AUTH_EXPIRED", "AUTH_FILE_MISSING", "AUTH_INVALID", "SIGN_IN_REQUIRED"])
const uploadNewFile = () => chooseCookiesFile().catch((err) => toast.error("Couldn't use that file", { description: errorMessage(err) }))

const FIX: Record<string, string> = {
  AUTH_EXPIRED: "Your cookies.txt was exported while signed out, or YouTube has stopped accepting it. In a new private window, sign in to YouTube, go to youtube.com/robots.txt, export the cookies, close the window, then upload the file.",
  AUTH_FILE_MISSING: "Upload a cookies.txt file in Settings → YouTube.",
  AUTH_INVALID: "Check the sign-in settings (browser name and profile).",
  SIGN_IN_REQUIRED: "Upload a cookies.txt file to download age-restricted videos and see your own playlists.",
  BROWSER_COOKIES_UNAVAILABLE: "Close the browser completely and retry (it locks its cookie database), check the profile name, or import a cookies file instead.",
  YTDLP_JS_CHALLENGE: "This is a yt-dlp problem, not your sign-in. Updating yt-dlp usually fixes it, and only changes yt-dlp. Public videos keep downloading meanwhile without sign-in.",
  YTDLP_MISSING: "yt-dlp downloads the music. Installing it only adds a file to this app's own folder.",
  NEEDS_RECONNECT: "Reconnect in Settings → YouTube. Your downloads and library aren't affected.",
  NOT_CONNECTED: "Connect Google in Settings → YouTube.",
  CLIENT_REJECTED: "Check your client in Google Cloud Console, or set it up again in Settings → YouTube.",
  QUOTA_EXCEEDED: "What's already loaded stays available.",
  API_NOT_ENABLED: "Turn on YouTube Data API v3 in Google Cloud Console.",
  NO_CHANNEL: "Create a channel on youtube.com, or connect a different Google account.",
  FOLDER_NOT_WRITABLE: "Choose a different music folder in Settings → Library.",
}

/** Clear, actionable message for sign-in problems, with a shortcut to the YouTube settings. */
export function AuthBanner({ code, message }: { code: string; message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{message}</p>
        {FIX[code] && <p className="mt-1 text-muted-foreground">{FIX[code]}</p>}
      </div>
      {(code === "YTDLP_JS_CHALLENGE" || code === "YTDLP_MISSING") && <UpdateYtDlpButton />}
      {NEEDS_NEW_FILE.has(code) && (
        <Button size="sm" onClick={() => void uploadNewFile()}>
          <FileUp /> Upload new cookies.txt
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => openSettings(code === "FOLDER_NOT_WRITABLE" ? "library" : "youtube")}>
        <Settings /> {code === "FOLDER_NOT_WRITABLE" ? "Library settings" : "YouTube settings"}
      </Button>
    </div>
  )
}
