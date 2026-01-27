import { shuffleArray } from "@/components/helpers/utilities";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/stores/useAppStore";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { useMusicStore, type CacheSongType } from "@/stores/useMusicStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { ListMusic, Search, Youtube } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import CacheResult from "../search/CacheResult";
import { Label } from "@/components/ui/label";
import { usePlayerStore } from "@/stores/usePlayerStore";
import type { Song } from "@/types/DirectoryTypes";
import { startNewQueue } from "@/utils/musicutils";
import { useYoutubeStore } from "@/components/Youtube/useYoutubeStore";

const SearchMusic = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const setMusicResults = useMusicStore((f) => f.setMusicResults);
  const rootMusicDir = useDirectoryStore((f) => f.rootDir);
  const songCache = useMusicStore((f) => f.songCache);
  const [suggestions, setSuggestions] = useState<CacheSongType[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const setQuery = useAppStore((f) => f.setQuery);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const recentlyPlayed = useMusicStore((f) => f.recentlyPlayed)
  const setRecentlyPlayed = useMusicStore((f) => f.setRecentlyPlayed)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const setRootDir = useDirectoryStore((f) => f.setRootDir)
  const setSongCache = useMusicStore((f) => f.setSongCache)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const totalItems = suggestions?.length + (searchQuery ? 2 : 0)
  const setPlaylists = useYoutubeStore((f) => f.setPlaylists)
  const setSearchTerm = useYoutubeStore((f) => f.setSearchTerm)
  const setView = useAppStore((f) => f.setView)
  const setYTSearchResults = useYoutubeStore((f) => f.setResults)
  const setPlaylistResults = useYoutubeStore((f) => f.setYoutubePlaylistResults)
  const incrementSearchTrigger = useYoutubeStore((f) => f.incrementTriggerSearchKey)


  const LS_KEY = "recentlyPlayed"

  const setPath = (path: any) => {
    setRootDir(path);
    localStorage.setItem("lastRootDir", path);
  };

  const loadDataFromLocalStorage = () => {
    const lastRootDir = localStorage.getItem("lastRootDir");
    if (lastRootDir) {
      setPath(lastRootDir);
    }
  }
  const handleCachePlay = async (song: CacheSongType) => {
    const body = {
      rootDir: rootMusicDir,
      path: song.path,
      forceRefresh: false,
    }

    const response: any = await (window as any).electron.getSongByPath(body)
    if (response.song) {
      setPlaying(response.song)
      setPaused(false)
      addRecentlyPlayed(response.song)
      startNewQueue(rootMusicDir, song.path)
    }
  }

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }
  const getSongCache = async () => {
    if (!rootMusicDir) return
    setIsLoading(true)
    try {
      const result = await (window as any).electron.getSongCache({
        rootDir: rootMusicDir,
        forceRefresh: false
      })
      if (result?.songs.length) {
        setSongCache(result.songs)
      }
    } catch (error) {
      console.error('Error loading songs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addRecentlyPlayed = (song: Song) => {
    const filtered = recentlyPlayed.filter((s) => s.name !== song.name || s.folderPath !== song.folderPath)
    const newRecPlayed = [song, ...filtered]
    setRecentlyPlayed(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }



  const searchMusic = async (query?: string) => {
    if (!rootMusicDir) return;
    setIsLoading(true);
    setQuery(query ?? "");

    try {
      const result = await (window as any).electron.searchSongs({
        rootDir: rootMusicDir,
        query,
        forceRefresh: false,
      });
      if (result.success) {
        setMusicResults(result.songs);
      }
    } catch (error) {
      console.error("Error loading songs:", error);
      toast.error("Search failed");
    } finally {
      setIsLoading(false);
    }
  };


  const handleFocus = () => {
    setOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => prev < totalItems - 1 ? prev + 1 : -1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > -1 ? prev - 1 : totalItems - 1);
        break;
      case 'Enter':
        if (focusedIndex === -1) {
          searchMusic(searchQuery)
          setSearchQuery("");
          setOpen(false);
          inputRef.current?.blur();
          return;
        } else if (focusedIndex < suggestions.length) {
          handleCachePlay(suggestions[focusedIndex]);
          setSearchQuery("");
          setOpen(false);
          setFocusedIndex(-1)
          inputRef.current?.blur();
        } else {
          setView("youtube");
          const buttonIndex = focusedIndex - suggestions.length;
          if (buttonIndex === 0) {
            setSearchTerm(searchQuery);
            setYTSearchResults([]);
            setSearchQuery("");
            setFocusedIndex(-1)
            setPlaylists(false);
          } else if (buttonIndex === 1) {
            setPlaylistResults([]);
            setSearchQuery("");
            setSearchTerm(searchQuery);
            setPlaylists(true);
            setFocusedIndex(-1)
          }
          incrementSearchTrigger();
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        setOpen(true);
    }
  }; const handleInlineSearch = () => {
    if (!searchQuery) {
      const randomSongs = shuffleArray(songCache).slice(0, 5)
      setSuggestions(randomSongs)
      setTimeout(() => {
      })
    } else {
      const cacheSuggestions = songCache.filter((song) => {
        const query = searchQuery?.toLowerCase()
        const titleMatch = song.title?.toLowerCase().includes(query)
        const artistMatch = song.artist?.toLowerCase().includes(query)
        return titleMatch || artistMatch
      }).slice(0, 5)
      setSuggestions(cacheSuggestions)
    }
  }

  useEffect(() => {
    handleInlineSearch()
  }, [searchQuery, songCache]);



  useEffect(() => {
    function handleKeyboardShortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        if (expanded) return;

        e.preventDefault();
        setOpen(prev => !prev);
        inputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboardShortcut);
    return () => document.removeEventListener("keydown", handleKeyboardShortcut);
  }, [expanded]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!open) return;
      const target = e.target as HTMLElement;
      if (target.closest(".task-save-btn")) {
        return;
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={searchContainerRef} className="w-full">
      <div className="relative w-full">
        <Search className="absolute text-muted-foreground left-2 top-1.5" />
        <Input
          ref={inputRef}
          className="pl-10 w-full"
          placeholder={isLoading ? "Loading..." : "Search..."}
          value={searchQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          disabled={isLoading}
        />

        {open && (
          <div className="absolute z-10 w-full top-full mt-1 rounded-lg bg-black/40 backdrop-blur-[5px] p-2">
            <div>
              {suggestions.length > 0 && (
                <>
                  <div>
                    <Label className="text-muted-foreground mb-2">Suggestions</Label>
                    <div className="">
                      {suggestions.map((song, idx) => (
                        <div
                          key={idx}
                          className={`text-xs rounded-md transition-colors ${focusedIndex === idx ? 'bg-accent/10 ring-1 ring-primary/50 pointer-events-none' : ''
                            }`}
                        >
                          <CacheResult
                            isPaused={paused}
                            onPause={handlePause}
                            onPlay={handleCachePlay}
                            onResume={handleResume}
                            isPlaying={currentlyPlaying?.metadata.title === song.title}
                            song={song}
                          />
                        </div>
                      ))}                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-2">

              {searchQuery.length > 0 && (
                <>
                  <div className="flex flex-col gap-2">
                    <div
                      className={`w-full rounded-sm  p-1 pl-2 flex gap-3 ${focusedIndex === suggestions.length ? 'bg-accent/10 ring-1 ring-primary/50 pointer-events-none' : 'bg-muted/50'
                        }`}
                    >
                      <Youtube className="text-red-500 shrink-0" />
                      <div className="line-clamp-1">Search video "{searchQuery}"</div>
                    </div>

                    <div
                      className={`w-full rounded-sm p-1 pl-2 flex gap-3 ${focusedIndex === suggestions.length + 1 ? 'bg-accent/10 ring-1 ring-primary/50 pointer-events-none' : 'bg-muted/50'
                        }`}
                    >
                      <ListMusic className="text-red-500 shrink-0" />
                      <div className="line-clamp-1">Search playlist "{searchQuery}"</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div >
  );
};

export default SearchMusic;
