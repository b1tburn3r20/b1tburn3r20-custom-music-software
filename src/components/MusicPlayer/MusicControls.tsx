import { usePlayerStore } from "@/stores/usePlayerStore"
import RewindButton from "./Controls/Rewind"
import FastForwardButton from "./Controls/FastForwardButton"
import MusicPlayButton from "./MusicPlayButton"
import LikeSongButton from "./Controls/like-song-button"
import ShuffleControls from "./Controls/ShuffleControls"
import { IconButton } from "@/components/base/IconButton"
import { Tags } from "lucide-react"
import { dialogs } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"

const MusicControls = () => {
  const currentSong = usePlayerStore((s) => s.currentlyPlaying)
  const tags = useUserStore((s) => (currentSong ? s.songTags[currentSong.id] : undefined))
  if (!currentSong) return null
  return (
    <div className="flex items-center gap-2">
      <ShuffleControls />
      <RewindButton />
      <MusicPlayButton />
      <FastForwardButton />
      <LikeSongButton song={currentSong} />
      <IconButton icon={Tags} label={tags?.length ? `Tags: ${tags.join(", ")} (T)` : "Tag this song (T)"} active={Boolean(tags?.length)} onClick={() => dialogs().openTags([currentSong])} />
    </div>
  )
}

export default MusicControls
