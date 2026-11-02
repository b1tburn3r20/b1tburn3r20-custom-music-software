import { Settings as SettingsIcon } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconButton } from "@/components/base/IconButton"
import PlaybackSettings from "./PlaybackSettings"
import LibrarySettings from "./LibrarySettings"
import AppearanceSettings from "./AppearanceSettings"
import YoutubeSettings from "./YoutubeSettings"
import { useSettingsDialog } from "./settingsStore"

const TABS = [
  { value: "appearance", label: "Appearance", Panel: AppearanceSettings },
  { value: "playback", label: "Playback", Panel: PlaybackSettings },
  { value: "library", label: "Library", Panel: LibrarySettings },
  { value: "youtube", label: "YouTube", Panel: YoutubeSettings },
]

export default function SettingsDialog() {
  const { open, tab, setOpen, setTab } = useSettingsDialog()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="max-h-[70vh] min-w-0 overflow-y-auto pr-1">
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
