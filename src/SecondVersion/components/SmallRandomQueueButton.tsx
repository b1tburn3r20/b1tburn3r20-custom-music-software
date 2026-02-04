import { useMusicStore } from "@/stores/useMusicStore"
import { startNewQueue } from "@/utils/musicutils"
import { Dice3, Dice4, Dice5, Dice2, Dice1, Dice6 } from "lucide-react"
import { useState } from "react"

const SmallRandomQueueButton = () => {
  const songCache = useMusicStore((f) => f.songCache)
  const diceIndex = useMusicStore((f) => f.diceIndex)
  const setDiceIndex = useMusicStore((f) => f.setDiceIndex)
  const [isRolling, setIsRolling] = useState(false)
  const diceComponents = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]



  const getRandomSong = () => {
    if (isRolling) return

    setIsRolling(true)
    const randomSongIndex = Math.floor(Math.random() * songCache.length)
    const availableIndices = [0, 1, 2, 3, 4, 5].filter(i => i !== diceIndex)
    const newDiceIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]

    setTimeout(() => {
      setDiceIndex(newDiceIndex)
      setIsRolling(false)
      startNewQueue(songCache[randomSongIndex].path)
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
    from-red-900 via-fuchsia-700 to-red-700
  "
    >

      <div className={`transition-opacity duration-75 ${isRolling ? 'opacity-20' : 'opacity-90'} `}>
        <DiceComponent size={40} />
      </div>
    </div>
  )
}

export default SmallRandomQueueButton
