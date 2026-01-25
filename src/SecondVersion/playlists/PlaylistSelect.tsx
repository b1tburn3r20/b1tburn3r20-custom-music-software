
import { Music } from "lucide-react";



interface PlaylistSelectProps {
  playlist: any
  onPlaylistSelect: (data: any) => void
}

const PlaylistSelect = ({ playlist, onPlaylistSelect }: PlaylistSelectProps) => {


  const handleClick = () => {
    onPlaylistSelect(playlist)
  }

  return (
    <div onClick={handleClick} className="shrink-0 cursor-pointer hover:scale-105 transition-all">
      <div className="h-full w-full bg-white/10 p-1 rounded-lg">
        <div className="p-1 bg-secondary rounded-lg flex justify-center items-center h-full w-full">
          <Music className="text-muted-foreground h-6 w-6 rounded-lg " />
          <div className="flex flex-col gap-1">
            {playlist.name}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlaylistSelect
