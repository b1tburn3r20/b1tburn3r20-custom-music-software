import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogHeader } from "@/components/ui/dialog"
import { Settings2 } from "lucide-react"
import NewChangeMusicFolder from "./NewMusicChangeFolder"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useEffect } from "react"
import RebuildCache from "../settings/RebuildCache"
import MusicStats from "./MusicStats"

const Settings = () => {
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)

  useEffect(() => {
    const handleKeyPress = (e: any) => {
      if (e.key === " " && !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) {
        e.preventDefault()
        e.stopPropagation()
        setPaused(!paused)
      }
    }

    window.addEventListener("keypress", handleKeyPress)

    return () => window.removeEventListener("keypress", handleKeyPress)
  }, [paused, setPaused])

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant={"outline"}>
            <Settings2 />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Music Player Settings
            </DialogTitle>
            <DialogDescription>
              Here you can change the settings for loads a stuff
            </DialogDescription>
          </DialogHeader>
          <NewChangeMusicFolder />
          <RebuildCache />
          <MusicStats />
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Settings
