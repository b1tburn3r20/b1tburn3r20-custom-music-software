import { Input } from "@/components/ui/input"
import { useRef } from "react"
import { useYoutubeStore } from "./Youtube/useYoutubeStore"
import { Loader2, Search } from "lucide-react"
const YoutubeInstall = () => {
  const searchTerm = useYoutubeStore((f) => f.searchTerm)
  const setSearchTerm = useYoutubeStore((f) => f.setSearchTerm)
  const setResults = useYoutubeStore((f) => f.setResults)
  const inputRef = useRef<HTMLInputElement>(null)
  const loading = useYoutubeStore((f) => f.searchingYoutube)
  const setLoading = useYoutubeStore((f) => f.setSearchingYoutube)
  const playlist = useYoutubeStore((f) => f.playlists)
  const setYoutubePlaylistResults = useYoutubeStore((f) => f.setYoutubePlaylistResults)
  //
  const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
  //
  //
  const searchYoutube = async (search: string) => {
    setResults([])
    setLoading(true)
    console.warn("Searching with", search)
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(search)}&key=${API_KEY}&type=${playlist ? "playlist" : "video"}&maxResults=${playlist ? "15" : "30"}`
      )
      const data = await response.json()
      if (playlist) {
        processYoutubePlaylistResponse(data.items)
      } else (
        processYoutubeResponse(data.items)
      )
      focusUp()
    } catch (error) {
      console.error("something went wrong", error)
    }
  }
  const processYoutubePlaylistResponse = async (results) => {
    const playlistIds = results.map(p => p.id.playlistId).join(',');
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistIds}&key=${API_KEY}`
    );
    const { items: playlistDetails } = await playlistRes.json();
    const playlistsWithVideos = await Promise.all(
      playlistDetails.map(async (playlist) => {
        const playlistId = playlist.id;
        const allVideos = [];
        let nextPageToken = null;
        do {
          const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
          const playlistItemsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${API_KEY}${pageTokenParam}`
          );
          const playlistItemsData = await playlistItemsRes.json();
          const videoIds = playlistItemsData.items
            .map(item => item.contentDetails.videoId)
            .filter(Boolean); // Filter out any undefined/null

          if (videoIds.length > 0) {
            const videoRes = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${videoIds.join(',')}&key=${API_KEY}`
            );
            const { items: videoDetails } = await videoRes.json();
            const videos = videoDetails.map(v => ({
              id: v.id,
              title: v.snippet.title,
              thumbnail: v.snippet.thumbnails.high?.url,
              duration: v.contentDetails.duration,
              lengthSeconds: parseISODuration(v.contentDetails.duration),
              views: v.statistics.viewCount,
              embeddable: v.status.embeddable,
              channel: v.snippet.channelTitle,
              categoryId: v.snippet.categoryId,
              publishedAt: v.snippet.publishedAt
            }));

            allVideos.push(...videos);
          }

          nextPageToken = playlistItemsData.nextPageToken;
        } while (nextPageToken);


        return {
          id: playlist.id,
          title: playlist.snippet.title,
          thumbnail: playlist.snippet.thumbnails.high?.url,
          channel: playlist.snippet.channelTitle,
          videoCount: playlist.contentDetails.itemCount,
          videos: allVideos,
          publishedAt: playlist.snippet.publishedAt
        };
      })
    );
    setYoutubePlaylistResults(playlistsWithVideos);
    setLoading(false)
  }; const processYoutubeResponse = async (results) => {
    const ids = results.map(v => v.id.videoId).join(',');
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${ids}&key=${API_KEY}`
    );
    const { items: details } = await videoRes.json();
    const videos = details.map(v => ({
      id: v.id,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails.high?.url,
      duration: v.contentDetails.duration,   // ISO 8601 like "PT4M12S"
      lengthSeconds: parseISODuration(v.contentDetails.duration),
      views: v.statistics.viewCount,
      embeddable: v.status.embeddable,
      channel: v.snippet.channelTitle,
      categoryId: v.snippet.categoryId,
      publishedAt: v.snippet.publishedAt
    }));
    setResults(videos)
    setLoading(false)
  }

  // helper to turn "PT4M12S" into seconds
  function parseISODuration(duration: string) {
    if (!duration) {
      return null
    }
    const match = duration?.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
    if (match) {
      const minutes = parseInt(match[1] || "0", 10);
      const seconds = parseInt(match[2] || "0", 10);
      return minutes * 60 + seconds;
    } else {
      return duration
    }
  }



  const handleKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value
    if (e.key === "Enter") {
      if (value.length > 0) {
        searchYoutube(value)
      } else {
        setResults([])
      }
    }
  }
  const focusUp = () => {
    inputRef?.current?.focus()
    inputRef?.current?.select()
  }
  const handleButtonSearch = () => {
    const val = inputRef?.current?.value?.trim()
    if (val) {
      searchYoutube(val)
    }
  }
  return (
    <div className="w-full border-none  relative bg-muted/30 rounded-xl">
      <div onClick={() => handleButtonSearch()} className="bg-accent/50 p-2 rounded-full absolute text-muted-foreground left-2 top-2">
        {loading ? (
          <Loader2 className="text-primary animate-spin" />
        ) : (

          <Search className="text-primary" />

        )}
      </div>
      <Input
        onClick={() => focusUp()}
        ref={inputRef}
        disabled={loading}
        className="w-full rounded-xl bg-transparent border-none pl-14 h-14"
        value={searchTerm}
        id="youtube-search"
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeydown}
        placeholder="Search youtube..."
      />

    </div>
  )
}
export default YoutubeInstall
