import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Filter } from "lucide-react"
import MusicCategoryOnlyFilter from "./youtubeFilters/music-category-only-filter"
import SafeSearchFilter from "./youtubeFilters/safe-search-filter"

const YoutubeSearchFilters = () => {
  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant={"ghost"}>
            <Filter />
          </Button>
        </PopoverTrigger>
        <PopoverContent variant="outline" className="grid grid-cols-2 gap-4 w-full">
          <MusicCategoryOnlyFilter />
          <SafeSearchFilter />
        </PopoverContent>
      </Popover>

    </div>
  )
}

export default YoutubeSearchFilters
