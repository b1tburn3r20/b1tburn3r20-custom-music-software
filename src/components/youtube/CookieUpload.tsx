// The main way into YouTube: upload a cookies.txt file. The steps follow yt-dlp's guidance.
// YouTube rotates cookies on any open tab, so a file exported normally soon stops working,
// which is why it has to come from a private window that's closed straight afterwards.
import { useState } from "react"
import { FileUp, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api"
import { ExternalLinkText } from "./ApiKeySetup"
import { chooseCookiesFile } from "./cookieFile"

const CHROME_EXTENSION = "https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
const FIREFOX_EXTENSION = "https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/"

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  )
}

export function CookieUpload({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const choose = async () => {
    setBusy(true)
    setError(null)
    try {
      if (await chooseCookiesFile()) onImported?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        <Step n={1}>
          Add a cookies extension to your browser: <ExternalLinkText href={CHROME_EXTENSION}>Get cookies.txt LOCALLY</ExternalLinkText> for Chrome or Edge, or <ExternalLinkText href={FIREFOX_EXTENSION}>cookies.txt</ExternalLinkText> for Firefox. Allow it to run in private windows.
        </Step>
        <Step n={2}>Open a new private window, and sign in to YouTube there.</Step>
        <Step n={3}>
          In that same tab, go to <b>youtube.com/robots.txt</b>. Use the extension to export the cookies in <b>Netscape</b> format.
        </Step>
        <Step n={4}>Close the private window, then choose the file below. If you skip closing it, YouTube soon stops accepting the file.</Step>
      </ol>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="self-start" disabled={busy} onClick={() => void choose()}>
        {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Choose cookies.txt
      </Button>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
        <span>This file can sign in as you, so don't share it. The app keeps only its YouTube and Google cookies, on this computer, and uses them only to talk to YouTube. Nothing is sent anywhere else.</span>
      </p>
    </div>
  )
}
