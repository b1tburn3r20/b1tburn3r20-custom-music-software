import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Page, Section } from "@/components/base/Page"
import { useDownloadStore, isActive } from "@/stores/useDownloadStore"
import { useYoutubeTab } from "@/components/youtube/tabStore"
import { SearchResults, YoutubeSearchBar } from "@/components/youtube/SearchTab"
import { MyPlaylists } from "@/components/youtube/MyPlaylists"
import { DownloadsList } from "@/components/youtube/DownloadsList"
import { canLoadData, useYoutubeAccess } from "@/components/youtube/accessStore"
import { YoutubeUnlock } from "@/components/youtube/YoutubeUnlock"

/**
 * Most visits are one of two things: find something, or see your own. So the box for
 * finding is always at the top, and your own playlists are what you land on.
 */
export default function YoutubePage() {
  const tab = useYoutubeTab((s) => s.tab)
  const setTab = useYoutubeTab((s) => s.setTab)
  const active = useDownloadStore((s) => Object.values(s.byId).filter(isActive).length)
  const access = useYoutubeAccess((s) => s.access)
  if (!access) return null
  return (
    <Page>
      <Section title="YouTube">
        <div className="flex flex-col gap-4">
          <YoutubeSearchBar />
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="mine">Your playlists</TabsTrigger>
              <TabsTrigger value="search">Results</TabsTrigger>
              <TabsTrigger value="downloads">Downloads{active ? ` (${active})` : ""}</TabsTrigger>
            </TabsList>
            <TabsContent value="mine" className="pt-4">
              {canLoadData(access) ? <MyPlaylists /> : <YoutubeUnlock />}
            </TabsContent>
            <TabsContent value="search" className="pt-4">
              <SearchResults />
            </TabsContent>
            <TabsContent value="downloads" className="pt-4">
              <DownloadsList />
            </TabsContent>
          </Tabs>
        </div>
      </Section>
    </Page>
  )
}
