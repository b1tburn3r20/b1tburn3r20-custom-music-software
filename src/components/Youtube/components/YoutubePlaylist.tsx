import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { TreeItem } from "@/types/DirectoryTypes"
import type { YoutubeDetailsResult, YoutubePlaylistResultType } from "@/types/YoutubeTypes"
import { formatDuration } from "@/utils/textUtils"
import { Check, Download, Loader2, X } from "lucide-react"
import { useState, useRef } from "react"
import { toast } from "sonner"
import NewPlaylistFromBase from "./NewPlaylistFromBase"

interface YoutubePlaylistProps {
  playlists: YoutubePlaylistResultType[],
  currentDir?: TreeItem | null
}

const YoutubePlaylists = ({ playlists, currentDir }: YoutubePlaylistProps) => {
  const [currentlyDownloading, setCurrentlyDownloading] = useState<string[]>([])
  const [currentlyDownloaded, setCurrentlyDownloaded] = useState<string[]>([])


  const PlaylistItem = ({ playlist }: { playlist: YoutubePlaylistResultType }) => {
    const [playlistDownloading, setPlaylistDownloading] = useState(false)
    const [playlistDownloaded, setPlaylistDownloaded] = useState(false)
    const [playlistError, setPlaylistError] = useState(false)
    const cancelRef = useRef(false)
    const songsLeftToDownload = playlist.videos.filter(video => !currentDir?.children?.some(child => child.name.normalize("NFC").includes(video.title.normalize("NFC"))))
    const currentlySavedSongs = playlist.videos.filter(video => currentDir?.children?.some(child => child.name.normalize("NFC").includes(video.title.normalize("NFC"))))
    const [error, setError] = useState<string | null>(null)

    if (error) {
      console.log("error", error)
    }
    const downloadPlaylist = async (playlist: YoutubePlaylistResultType, newdir?: TreeItem) => {

      if (playlistDownloading) return;

      const dir = newdir ? newdir : currentDir
      if (!dir) {
        setError('Please select a folder first');
        toast.error('Please select a folder first');
        return;
      }

      cancelRef.current = false
      setPlaylistDownloading(true)
      setPlaylistError(false)
      const songsToDownload = playlist.videos.filter(video =>
        !currentDir?.children?.some(child => child.name.includes(video.title))
      );
      try {
        const downloadPromises = songsToDownload.map((song, index) => {
          return new Promise(async (resolve) => {
            await new Promise(r => setTimeout(r, index * 500))
            if (cancelRef.current) {
              resolve(null)
              return
            }
            await globalDownloadSong(song, dir)
            resolve(null)
          })
        })

        await Promise.all(downloadPromises)

        if (!cancelRef.current) {
          setPlaylistDownloaded(true)
          setTimeout(() => {
            setPlaylistDownloaded(false)
          }, 3000)
        }
      } catch (error) {
        setPlaylistError(true)
        toast.error("Playlist download failed")
        console.error(error)
        setTimeout(() => {
          setPlaylistError(false)
        }, 1000)
      } finally {
        setPlaylistDownloading(false)
      }
    }

    const cancelDownload = () => {
      cancelRef.current = true
      setPlaylistDownloading(false)
      toast.info("Download cancelled")
    }

    const globalDownloadSong = async (result: YoutubeDetailsResult, dir: TreeItem | null | undefined) => {
      if (!dir || cancelRef.current) {
        return;
      }

      setCurrentlyDownloading(prev => [...prev, result.id])
      setError(null);

      try {
        const response = await window.electron.downloadYoutube({
          videoId: result.id,
          title: result.title,
          savePath: dir.path
        });

        if (response.success && !cancelRef.current) {
          setCurrentlyDownloaded(prev => [...prev, result.id])
          setTimeout(() => {
            setCurrentlyDownloaded((prev) => {
              return (prev.filter((ids) => ids !== result.id))
            })
          }, 3000);
        } else if (!response.success) {
          toast.error(`Failed: ${result.title}`);
          setError(response.error);
        }
      } catch (err) {
        toast.error(`Error downloading: ${result.title}`);
        setError(err.toString() || 'Failed to download video');
      } finally {
        setCurrentlyDownloading((prev) => {
          return (
            prev.filter((ids) => ids !== result.id)
          )
        })
      }
    }

    const handlePlaylistCreate = (newDir: TreeItem) => {
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
              <div className="font-bold">{playlist.title}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2 items-center">
                <NewPlaylistFromBase playlist={playlist} onPlaylistCreate={(newDir) => handlePlaylistCreate(newDir)} />
                {songsLeftToDownload.length > 0 ? (
                  <>
                    {(playlistDownloading || isAnyDownloading) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          cancelDownload()
                        }}
                      >
                        <X />
                      </Button>
                    )}
                    <Button
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
              <div className="flex flex-col">
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
            {playlist.videos.map((song) => (
              <PlaylistSongItem key={song.id} song={song} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  const PlaylistSongItem = ({ song }: { song: YoutubeDetailsResult }) => {
    const [downloaded, setDownloaded] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const downloadSong = async (result: YoutubeDetailsResult) => {
      if (!currentDir) {
        setError('Please select a folder first');
        toast.error('Please select a folder first');
        return;
      }

      setDownloading(true);
      setError(null);
      setHasError(false);
      if (error) {
        console.log("error", error)
      }
      try {
        const response = await window.electron.downloadYoutube({
          videoId: result.id,
          title: result.title,
          savePath: currentDir.path
        });

        if (response.success) {
          setDownloaded(true);
          setTimeout(() => setDownloaded(false), 3000);
        } else {
          setHasError(true);
          toast.error(response.error || 'Download failed');
          setTimeout(() => {
            setHasError(false);
          }, 1000);
        }
      } catch (err) {
        setHasError(true);
        const errorMsg = err.toString() || 'Failed to download video';
        toast.error(errorMsg);
        setTimeout(() => {
          setHasError(false);
        }, 1000);
      } finally {
        setDownloading(false);
      }
    }

    const isDownloading = downloading || currentlyDownloading.includes(song.id)
    const isDownloaded = downloaded || currentlyDownloaded.includes(song.id)
    const isSaved = currentDir?.children?.some(child =>
      (child.metadata?.title.normalize("NFC") || '').includes(song.title.normalize("NFC"))
    );


    return (
      <div key={song.id} className="flex pb-2 justify-between">
        <div className="flex items-center gap-4">
          <div className="shrink-0 aspect-square bg-white/10 p-1 rounded-lg">
            <img className="shrink-0 w-10 h-10 object-cover rounded-lg" src={song.thumbnail} />
          </div>
          <div>{song.title}</div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="font-semibold text-muted-foreground">{formatDuration(song.lengthSeconds)}</div>
          {
            isSaved ? (
              <Check />
            ) : (

              <Button
                disabled={isDownloaded || isDownloading}
                onClick={() => downloadSong(song)}
                className={hasError ? 'animate-pulse bg-red-500 hover:bg-red-600' : ''}
              >
                {isDownloading ? <Loader2 className="animate-spin" /> : <>
                  {isDownloaded ? <Check /> : <Download />}
                </>}
              </Button>

            )
          }
        </div>
      </div>
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
