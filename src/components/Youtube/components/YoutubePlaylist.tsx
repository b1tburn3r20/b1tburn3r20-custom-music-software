import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useMusicStore } from "@/stores/useMusicStore"
import type { Song } from "@/types/DirectoryTypes"
import type { YoutubeDetailsResult, YoutubePlaylistResultType } from "@/types/YoutubeTypes"
import { Check, Download, ListMusic, Loader2, X } from "lucide-react"
import { useState, useRef } from "react"
import { toast } from "sonner"
import PlaylistSongItem from "./PlaylistSongItem"

interface YoutubePlaylistProps {
  playlists: YoutubePlaylistResultType[],
  currentDir?: any | null
}

const YoutubePlaylists = ({ playlists, currentDir }: YoutubePlaylistProps) => {
  const [currentlyDownloading, setCurrentlyDownloading] = useState<string[]>([])
  const [currentlyDownloaded, setCurrentlyDownloaded] = useState<string[]>([])
  const setRecentlyDownloaded = useMusicStore((f) => f.setRecentlyDownloaded)
  const addSongToCache = useMusicStore((f) => f.addSongToCache)
  const recentlyDownloaded = useMusicStore((f) => f.recentlyDownloaded)
  const LS_KEY = "userRecentlyDownloaded"

  const addRecentlyDownloaded = (song: Song) => {
    const filtered = recentlyDownloaded.filter((s) => s.name !== song.name || s.folderPath !== song.folderPath)
    const newRecPlayed = [song, ...filtered]
    setRecentlyDownloaded(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }

  const PlaylistItem = ({ playlist }: { playlist: YoutubePlaylistResultType }) => {
    const [playlistDownloading, setPlaylistDownloading] = useState(false)
    const [playlistDownloaded, setPlaylistDownloaded] = useState(false)
    const [playlistError, setPlaylistError] = useState(false)
    const cancelRef = useRef(false)

    const songsLeftToDownload = playlist.videos.filter(video =>
      !currentDir?.children?.some(child =>
        child.name.normalize("NFC").includes(video.title.normalize("NFC"))
      )
    )
    const currentlySavedSongs = playlist.videos.filter(video =>
      currentDir?.children?.some(child =>
        child.name.normalize("NFC").includes(video.title.normalize("NFC"))
      )
    )

    const downloadPlaylist = async (playlist: YoutubePlaylistResultType, newdir?: any) => {
      if (playlistDownloading) return;

      const dir = newdir ? newdir : currentDir
      if (!dir) {
        toast.error('Please select a folder first');
        return;
      }

      cancelRef.current = false
      setPlaylistDownloading(true)
      setPlaylistError(false)

      const songsToDownload = playlist.videos.filter(video =>
        !currentDir?.children?.some(child =>
          child.name.normalize("NFC").includes(video.title.normalize("NFC"))
        )
      );

      try {
        for (const song of songsToDownload) {
          if (cancelRef.current) {
            console.log('Breaking playlist download loop')
            break
          }
          await globalDownloadSong(song, dir)
        }

        if (!cancelRef.current) {
          setPlaylistDownloaded(true)
          setTimeout(() => {
            setPlaylistDownloaded(false)
          }, 3000)
        }
      } catch (error) {
        if (!cancelRef.current) {
          setPlaylistError(true)
          toast.error("Playlist download failed")
          console.error(error)
          setTimeout(() => {
            setPlaylistError(false)
          }, 1000)
        }
      } finally {
        setPlaylistDownloading(false)
      }
    }

    const cancelPlaylistDownload = async () => {
      console.log('CANCELLING ENTIRE PLAYLIST')
      cancelRef.current = true
      try {
        await (window as any).electron.cancelDownload()
        console.log('Backend cancel successful')
      } catch (err) {
        console.error('Error cancelling download:', err)
      }
      setPlaylistDownloading(false)
      toast.info("Playlist download cancelled")
    }

    const globalDownloadSong = async (result: YoutubeDetailsResult, dir: any | null | undefined) => {
      if (!dir || cancelRef.current) {
        console.log('Skipping download - no dir or cancelled')
        return;
      }

      setCurrentlyDownloading(prev => [...prev, result.id])

      try {
        const response = await (window as any).electron.downloadYoutube({
          videoId: result.id,
          title: result.title,
          savePath: dir
        });

        if (cancelRef.current) {
          console.log('Download cancelled, skipping response processing')
          return;
        }

        if (response.name) {
          addRecentlyDownloaded(response)
          setCurrentlyDownloaded(prev => [...prev, result.id])
          const body = {
            title: response.metadata.title,
            artist: response.metadata.artist,
            path: response.path,
            thumbnail: response.metadata.thumbnail
          }
          addSongToCache(body)

          setTimeout(() => {
            setCurrentlyDownloaded((prev) => {
              return (prev.filter((ids) => ids !== result.id))
            })
          }, 3000);
        } else if (!response.success) {
          toast.error(`Failed: ${result.title}`);
        }
      } catch (err: any) {
        if (!cancelRef.current && !err.message?.includes('cancelled')) {
          toast.error(`Error downloading: ${result.title}`);
        }
      } finally {
        setCurrentlyDownloading((prev) => {
          return (
            prev.filter((ids) => ids !== result.id)
          )
        })
      }
    }

    const handlePlaylistCreate = (newDir: any) => {
      setTimeout(() => {
        downloadPlaylist(playlist, newDir)
      }, 200)
    }

    const downloadingCount = playlist.videos.filter(v => currentlyDownloading.includes(v.id)).length
    const isAnyDownloading = downloadingCount > 0

    return (
      <AccordionItem className="my-2" key={playlist.id} value={playlist.id}>
        <AccordionTrigger className="w-full px-4 mb-4 bg-muted/50">
          <div className="flex justify-between items-center w-full">
            <div className="flex gap-2 items-center">
              <div className="shrink-0 aspect-square bg-white/10 p-1 rounded-lg">
                <img className="shrink-0 w-14 h-14 object-cover rounded-lg" src={playlist.thumbnail} />
              </div>
              <div className="font-bold">{playlist.title} - <span className="text-muted-foreground">{playlist.channel}</span> </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2 items-center">
                {songsLeftToDownload.length > 0 ? (
                  <>
                    {(playlistDownloading || isAnyDownloading) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          cancelPlaylistDownload()
                        }}
                      >
                        <X />
                      </Button>
                    )}
                    <Button variant={"muted_red"} onClick={handlePlaylistCreate}>
                      <ListMusic />
                    </Button>
                    <Button
                      variant={"muted_red"}
                      disabled={isAnyDownloading || playlistDownloading || playlistDownloaded}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        downloadPlaylist(playlist)
                      }}
                      className={playlistError ? 'animate-pulse bg-red-500 hover:bg-red-600' : ''}
                    >
                      {(isAnyDownloading || playlistDownloading) ? <Loader2 className="animate-spin" /> : <>
                        {playlistDownloaded ? <Check /> : <Download />}
                      </>}
                    </Button>
                  </>
                ) : (
                  <Check />
                )}
              </div>
              <div className="flex flex-col w-[80px]">
                {currentlySavedSongs.length > 0 ? (
                  <>
                    {currentlySavedSongs.length == Number(playlist.videoCount) ? (
                      <div className="text-muted-foreground">{currentlySavedSongs.length} / {playlist.videoCount}</div>
                    ) : (
                      <div className="flex flex-col">
                        <div>{playlist.videoCount} songs</div>
                        <Separator className="my-1 text-muted-foreground" />
                        <div className="text-muted-foreground">{currentlySavedSongs.length} saved</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div>{playlist.videoCount} songs</div>
                )}
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-2">
            {playlist.videos.map((song, indx) => (
              <PlaylistSongItem
                key={song.id}
                song={song}
                index={indx}
                currentDir={currentDir}
                isDownloading={currentlyDownloading.includes(song.id)}
                isDownloaded={currentlyDownloaded.includes(song.id)}
                onDownloadComplete={addRecentlyDownloaded}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  return (
    <div>
      <Accordion
        type="multiple"
        className="w-full"
      >
        {playlists.map((playlist) => <PlaylistItem key={playlist.id} playlist={playlist} />)}
      </Accordion>
    </div>
  )
}

export default YoutubePlaylists
