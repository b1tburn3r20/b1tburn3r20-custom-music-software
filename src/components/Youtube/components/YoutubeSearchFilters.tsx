import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Filter } from "lucide-react"
import YoutubePlaylistFilter from "./YoutubePlaylistFilter"

const YoutubeSearchFilters = () => {
  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant={"ghost"}>
            <Filter />
          </Button>
        </PopoverTrigger>
        <PopoverContent variant="outline">
          none atm
        </PopoverContent>
      </Popover>

    </div>
  )
}

export default YoutubeSearchFilters
