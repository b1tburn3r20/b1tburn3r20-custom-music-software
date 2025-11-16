"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import YoutubeSearchContainer from "../Youtube/components/YoutubeSearchContainer"
import PlayingPlaylist from "../Music/PlayingPlaylist"

const RightContainer = () => {
  return (
    <div className="h-full min-w-lg flex flex-col flex-1">
      <Tabs defaultValue="currently-playing" className="bg-black/50 h-full flex flex-col">
        <TabsList className="bg-black/50 rounded-none w-full shrink-0">
          <TabsTrigger value="currently-playing">Music</TabsTrigger>
          <TabsTrigger value="youtube">Youtube</TabsTrigger>
        </TabsList>
        <TabsContent className="flex-1 min-h-0 m-0" value="currently-playing">
          <PlayingPlaylist />
        </TabsContent>
        <TabsContent className="flex-1 min-h-0 m-0" value="youtube">
          <YoutubeSearchContainer />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RightContainer
