import { Music2 } from "lucide-react"

interface SongSkeletonProps {
  dominantColor: string
}

const SongSkeleton = ({ dominantColor }: SongSkeletonProps) => {
  const randomTitleLength = Math.floor(Math.random() * 50) + 40
  const randomArtistLength = Math.floor(Math.random() * 20) + 20


  return (
    <div className="h-14 w-full rounded-lg bg-black/20 animate-pulse flex gap-2 items-center">
      <div
        className="p-1 rounded-lg flex flex-col justify-center items-center aspect-square h-full w-auto"
        style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
      >

        <Music2
          className="h-10 w-10 rounded-lg p-2"
          style={{ color: `rgb(${dominantColor})` }}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className={`bg-white/50 h-4 rounded-lg `}
          style={{ width: `${randomTitleLength}%` }}
        >
        </div>
        <div className="flex gap-1 items-center">

          <div className="bg-muted-foreground/50 h-4 rounded-lg"

            style={{ width: `${randomArtistLength}%` }}

          >
          </div>
          <div className="bg-muted-foreground/50 h-4 w-10 rounded-lg">
          </div>

        </div>
      </div>
      <div>


      </div>


    </div>



  )
}

export default SongSkeleton
