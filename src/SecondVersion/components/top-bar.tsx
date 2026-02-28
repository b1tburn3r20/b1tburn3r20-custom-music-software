import SearchMusic from "./search-music"
import Settings from "./Settings"
const TopBar = () => {
  return (
    <div className="w-full p-4 flex items-center ">
      <div className="mx-auto max-w-[400px] container flex gap-2">
        <SearchMusic />
      </div>
      <div>
        <Settings />
      </div>
    </div>
  )
}

export default TopBar
