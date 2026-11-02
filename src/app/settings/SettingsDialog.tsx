import { Settings as SettingsIcon } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconButton } from "@/components/base/IconButton"
import PlaybackSettings from "./PlaybackSettings"
import LibrarySettings from "./LibrarySettings"

const TABS = [
  { value: "playback", label: "Playback", Panel: PlaybackSettings },
  { value: "library", label: "Library", Panel: LibrarySettings },
]

export default function SettingsDialog() {
  const [tab, setTab] = useState(TABS[0].value)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton icon={SettingsIcon} label="Settings" size="md" className="bg-muted/60" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription className="sr-only">App settings</DialogDescription>
        <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="grid min-h-96 grid-cols-[10rem_1fr] gap-6">
          <TabsList className="flex h-fit flex-col items-stretch gap-1 bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="justify-start">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-w-0">
            {TABS.map(({ value, Panel }) => (
              <TabsContent key={value} value={value} className="mt-0">
                <Panel />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
