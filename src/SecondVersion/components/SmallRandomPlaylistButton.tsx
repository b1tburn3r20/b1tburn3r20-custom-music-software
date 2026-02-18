
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Dice3, Dice4, Dice5, Dice2, Dice1, Dice6 } from "lucide-react"
import { useState } from "react"

const SmallRandomPlaylistButton = () => {
  const diceIndex = useMusicStore((f) => f.playlistDiceIndex)
  const setDiceIndex = useMusicStore((f) => f.setPlaylistDiceIndex)
  const [isRolling, setIsRolling] = useState(false)
  const diceComponents = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]
  const playlists = useMusicStore((f) => f.playlists)
  const setPlayingPlaylist = usePlayerStore((f) => f.setPlayingPlaylist)
  const setQueue = useMusicStore((f) => f.setQueue)
  const startPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)


  const getRandomSong = () => {
    if (isRolling) return

    setIsRolling(true)
    const randomPlaylistIndex = Math.floor(Math.random() * playlists.length)
    const availableIndices = [0, 1, 2, 3, 4, 5].filter(i => i !== diceIndex)
    const newDiceIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]

    setTimeout(() => {
      setDiceIndex(newDiceIndex)
      setIsRolling(false)
      const randomPlaylist = playlists[randomPlaylistIndex]
      setQueue(randomPlaylist.songs)
      startPlaying(randomPlaylist.songs[0])
      setPaused(false)
      setPlayingPlaylist(randomPlaylist)
    }, 75)
  }


  const DiceComponent = diceComponents[diceIndex] || Dice1

  return (
    <div
      onClick={getRandomSong}
      className="
    p-1 h-full w-full cursor-pointer flex justify-center items-center rounded-lg
    bg-radial
    [--tw-gradient-position:at_top_right]
    from-sky-900 via-emerald-700 to-blue-700
  "
    >

      <div className={`transition-opacity duration-75 ${isRolling ? 'opacity-20' : 'opacity-90'} `}>
        <DiceComponent size={40} />
      </div>
    </div>
  )
}

export default SmallRandomPlaylistButton 
