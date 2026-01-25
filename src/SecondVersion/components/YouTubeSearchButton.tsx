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
      setTimeout(() => {
        const btn = document.getElementById("youtube-search")
        if (btn) {
          btn.focus()
        }
      }, 150)
    }
  }
  return (
    <div>
      <Button onClick={() => handleClick()} variant={"muted_red"}>
        {onPage ? (<Home />) : (<Youtube />)}
      </Button>

    </div>
  )
}

export default YouTubeSearchButton
