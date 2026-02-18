import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Dice3, Dice4, Dice5, Dice2, Dice1, Dice6 } from "lucide-react"
import { useEffect, useState } from "react"

const RandomPlaylistButton = () => {
  const playlists = useMusicStore((f) => f.playlists)
  const diceIndex = useMusicStore((f) => f.playlistDiceIndex)
  const setDiceIndex = useMusicStore((f) => f.setPlaylistDiceIndex)
  const [isRolling, setIsRolling] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const diceComponents = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]
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
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1320)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])


  return (
    <div
      onClick={getRandomSong}
      className="
    p-3 h-full w-full cursor-pointer flex justify-center items-center rounded-3xl
    bg-radial
    [--tw-gradient-position:at_top_right]
    from-sky-900 via-emerald-700 to-blue-700
  "
    >

      <div className={`transition-opacity duration-75 ${isRolling ? 'opacity-20' : 'opacity-100'} `}>
        <DiceComponent size={isLargeScreen ? 240 : 140} />
      </div>
    </div>
  )
}

export default RandomPlaylistButton
