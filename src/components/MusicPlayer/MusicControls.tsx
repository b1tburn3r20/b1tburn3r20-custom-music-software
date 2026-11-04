import RewindButton from "./Controls/Rewind"
import FastForwardButton from "./Controls/FastForwardButton"
import MusicPlayButton from "./MusicPlayButton"
import ShuffleControls from "./Controls/ShuffleControls"
import LoopingControls from "./Controls/LoopingControls"

/** Transport, centred: shuffle · previous · play · next · repeat. */
const MusicControls = () => (
  <div role="group" aria-label="Playback" className="flex items-center gap-5">
    <ShuffleControls />
    <RewindButton />
    <MusicPlayButton />
    <FastForwardButton />
    <LoopingControls />
  </div>
)

export default MusicControls
