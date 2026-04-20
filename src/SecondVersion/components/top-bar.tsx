import SearchMusic from "./search-music"
import ChatSettings from "./Settings"
const TopBar = () => {
  return (
    <div className="w-full p-4 flex items-center ">
      <div className="mx-auto max-w-100 container flex gap-2">
        <SearchMusic />
      </div>
      <div>
        <ChatSettings />
      </div>
    </div>
  )
}

export default TopBar
