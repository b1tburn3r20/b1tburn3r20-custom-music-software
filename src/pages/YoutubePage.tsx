import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Page, Section } from "@/components/base/Page"
import { useDownloadStore, isActive } from "@/stores/useDownloadStore"
import { useYoutubeTab } from "@/components/youtube/tabStore"
import { SearchTab } from "@/components/youtube/SearchTab"
import { MyPlaylists } from "@/components/youtube/MyPlaylists"
import { DownloadsList } from "@/components/youtube/DownloadsList"

export default function YoutubePage() {
  const tab = useYoutubeTab((s) => s.tab)
  const setTab = useYoutubeTab((s) => s.setTab)
  const active = useDownloadStore((s) => Object.values(s.byId).filter(isActive).length)
  return (
    <Page>
      <Section title="YouTube">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="mine">My playlists</TabsTrigger>
            <TabsTrigger value="downloads">Downloads{active ? ` (${active})` : ""}</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="pt-4">
            <SearchTab />
          </TabsContent>
          <TabsContent value="mine" className="pt-4">
            <MyPlaylists />
          </TabsContent>
          <TabsContent value="downloads" className="pt-4">
            <DownloadsList />
          </TabsContent>
        </Tabs>
      </Section>
    </Page>
  )
}
