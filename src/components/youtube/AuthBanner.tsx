import { AlertTriangle, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { openSettings } from "@/app/settings/settingsStore"


const FIX: Record<string, string> = {
  AUTH_EXPIRED: "Open YouTube in your browser and sign in again. If you use a cookies file, export a fresh one and import it again.",
  AUTH_FILE_MISSING: "Import an exported cookies.txt file, or switch to reading cookies from your browser.",
  AUTH_INVALID: "Check the sign-in settings (browser name and profile).",
  SIGN_IN_REQUIRED: "Set up YouTube sign-in to download age-restricted videos and see your own playlists.",
  BROWSER_COOKIES_UNAVAILABLE: "Close the browser completely and retry (it locks its cookie database), check the profile name, or import a cookies file instead.",
  YTDLP_JS_CHALLENGE: "This is a yt-dlp installation problem, not your sign-in: run a full system update (sudo pacman -Syu) so yt-dlp-ejs matches yt-dlp, then retry. Public videos keep downloading meanwhile without sign-in.",
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
      <Button size="sm" variant="secondary" onClick={() => openSettings("youtube")}>
        <Settings /> YouTube settings
      </Button>
    </div>
  )
}
