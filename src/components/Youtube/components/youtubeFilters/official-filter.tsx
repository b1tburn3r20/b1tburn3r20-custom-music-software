import { Label } from "@/components/ui/label"
import { useYoutubeStore } from "../../useYoutubeStore"
import { Switch } from "@/components/ui/switch"

const OfficialFilter = () => {
  const on = useYoutubeStore((f) => f.officialFilter)
  const setOn = useYoutubeStore((f) => f.setOfficialFilter)



  return (
    <div onClick={() => setOn(!on)} className="p-2 rounded-lg bg-muted/40 flex flex-col gap-1">
      <Label>Official Results Only</Label>
      <Switch checked={on} />
    </div>
  )
}

export default OfficialFilter 
