import { Label } from "@/components/ui/label"
import { useYoutubeStore } from "../../useYoutubeStore"
import { Switch } from "@/components/ui/switch"

const MusicCategoryOnlyFilter = () => {
  const on = useYoutubeStore((f) => f.musicCategoryOnly)
  const setOn = useYoutubeStore((f) => f.setMusicCategoryOnly)



  return (
    <div onClick={() => setOn(!on)} className="p-2 rounded-lg bg-muted/40 flex flex-col gap-1">
      <Label>Music Category Only Filter</Label>
      <Switch checked={on} />
    </div>
  )
}

export default MusicCategoryOnlyFilter 
