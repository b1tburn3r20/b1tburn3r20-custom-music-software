import { Label } from "@/components/ui/label"
import { useYoutubeStore } from "../../useYoutubeStore"
import { Switch } from "@/components/ui/switch"

const SafeSearchFilter = () => {
  const on = useYoutubeStore((f) => f.safeSearch)
  const setOn = useYoutubeStore((f) => f.setSafeSearch)



  return (
    <div onClick={() => setOn(!on)} className="p-2 rounded-lg bg-muted/40 flex flex-col gap-1">
      <Label>Toggle Safe Search</Label>
      <Switch checked={on} />
    </div>
  )
}

export default SafeSearchFilter 
