import { Button } from "@/components/ui/button"
import { useAppStore } from "@/stores/useAppStore"
import { Home, Youtube } from "lucide-react"

const YouTubeSearchButton = () => {
  const setView = useAppStore((f) => f.setView)
  const view = useAppStore((f) => f.view)

  const onPage = view === "youtube"


  const handleClick = () => {
    if (onPage) {
      setView("home")
    } else {

      setView("youtube")
    }
  }
  return (
    <div>
      <Button onClick={() => handleClick()} variant={"ghost"} className="text-red-500 bg-muted">
        {onPage ? (<Home />) : (<Youtube />)}
      </Button>

    </div>
  )
}

export default YouTubeSearchButton
