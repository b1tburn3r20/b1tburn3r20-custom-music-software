import { IconButton } from "@/components/base/IconButton"
import { setLiked } from "@/lib/actions"
import { useUserStore } from "@/stores/useUserStore"
import type { Song } from "@/types/DirectoryTypes"
import { Heart, HeartCrack } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const LikeSongButton = ({ song }: { song: Song }) => {
  const liked = useUserStore((s) => s.likedIds.has(song.id))
  const [hovered, setHovered] = useState(false)
  return (
    <IconButton
      icon={hovered && liked ? HeartCrack : Heart}
      label={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
      aria-pressed={liked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => void setLiked(song.id, !liked)}
      iconClassName={cn(liked && "fill-current text-like")}
    />
  )
}
export default LikeSongButton
