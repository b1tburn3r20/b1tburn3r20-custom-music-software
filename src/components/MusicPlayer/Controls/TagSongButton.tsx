import { IconButton } from "@/components/base/IconButton"
import { dialogs } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import type { Song } from "@/types/DirectoryTypes"
import { Tags } from "lucide-react"

const TagSongButton = ({ song }: { song: Song }) => {
  const tags = useUserStore((s) => s.songTags[song.id])
  return (
    <IconButton
      icon={Tags}
      size="sm"
      label={tags?.length ? `Tags: ${tags.join(", ")} (T)` : "Tag this song (T)"}
      active={Boolean(tags?.length)}
      onClick={() => dialogs().openTags([song])}
    />
  )
}
export default TagSongButton
