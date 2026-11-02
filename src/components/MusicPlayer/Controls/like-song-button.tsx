import { setLiked } from "@/lib/actions"
import { useUserStore } from "@/stores/useUserStore"
import type { Song } from "@/types/DirectoryTypes"
import { Heart, HeartCrack } from "lucide-react"
import { useState } from "react"

const LikeSongButton = ({ song }: { song: Song }) => {
  const liked = useUserStore((s) => s.likedIds.has(song.id))
  const [hovered, setHovered] = useState(false)
  return (
    <button
      aria-label={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
      aria-pressed={liked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => void setLiked(song.id, !liked)}
      className={`rounded-full flex justify-center items-center p-4 cursor-pointer transition-colors hover:bg-secondary/50 ${liked ? "text-destructive hover:text-muted-foreground" : "hover:text-primary"}`}
    >
      {hovered && liked ? <HeartCrack /> : <Heart className={liked ? "fill-current" : ""} />}
    </button>
  )
}

export default LikeSongButton
