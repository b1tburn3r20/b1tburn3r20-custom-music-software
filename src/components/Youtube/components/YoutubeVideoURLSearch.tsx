import { useState, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Loader2, Link2, AlertCircle, X } from "lucide-react";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import YoutubeVideoResult from "./YoutubeVideoResult";
import type { YoutubeDetailsResult } from '@/types/YoutubeTypes';
import { useYoutubeStore } from '../useYoutubeStore';

const YoutubeVideoURLSearch = () => {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<YoutubeDetailsResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentDir = useDirectoryStore((f) => f.rootDir);
  const setYoutubePlaylistResults = useYoutubeStore((f) => f.setYoutubePlaylistResults);
  const playlist = useYoutubeStore((f) => f.playlists);

  const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

  const extractVideoId = (url: string): string | null => {
    try {
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const extractPlaylistId = (url: string): string | null => {
    try {
      const patterns = [
        /[?&]list=([^&\n?#]+)/,
        /^(PL[a-zA-Z0-9_-]+)$/,
        /^(UU[a-zA-Z0-9_-]+)$/,
        /^(FL[a-zA-Z0-9_-]+)$/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const parseISODuration = (duration: string): number => {
    if (!duration) return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (match) {
      const hours = parseInt(match[1] || "0", 10);
      const minutes = parseInt(match[2] || "0", 10);
      const seconds = parseInt(match[3] || "0", 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  };

  const reset = () => {
    setError(null);
    setVideoResult(null);
  };

  const fetchPlaylistDetails = async (playlistId: string) => {
    setLoading(true);
    setError(null);
    setVideoResult(null);

    try {
      const playlistRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${API_KEY}`
      );
      const playlistData = await playlistRes.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        setError('Playlist not found. Please check the URL and try again.');
        setLoading(false);
        return;
      }

      const playlist = playlistData.items[0];
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
          .filter(Boolean);

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

      const playlistWithVideos = {
        id: playlist.id,
        title: playlist.snippet.title,
        thumbnail: playlist.snippet.thumbnails.high?.url,
        channel: playlist.snippet.channelTitle,
        videoCount: playlist.contentDetails.itemCount,
        videos: allVideos,
        publishedAt: playlist.snippet.publishedAt
      };

      setYoutubePlaylistResults([playlistWithVideos]);
    } catch (err) {
      setError('Failed to fetch playlist details. Please try again.');
      console.error('Error fetching playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideoDetails = async (videoId: string) => {
    setLoading(true);
    setError(null);
    setVideoResult(null);

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${videoId}&key=${API_KEY}`
      );

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        setError('Video not found. Please check the URL and try again.');
        setLoading(false);
        return;
      }

      const video = data.items[0];
      const videoDetails: YoutubeDetailsResult = {
        id: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
        duration: video.contentDetails.duration,
        lengthSeconds: parseISODuration(video.contentDetails.duration),
        views: video.statistics.viewCount,
        embeddable: video.status.embeddable,
        channel: video.snippet.channelTitle,
        categoryId: video.snippet.categoryId,
        publishedAt: video.snippet.publishedAt
      };

      setVideoResult(videoDetails);
    } catch (err) {
      setError('Failed to fetch video details. Please try again.');
      console.error('Error fetching video:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      setError(`Please enter a YouTube ${playlist ? 'playlist' : 'video'} URL or ID`);
      return;
    }

    if (playlist) {
      // Playlist mode - only search for playlists
      const playlistId = extractPlaylistId(trimmedUrl);
      if (playlistId) {
        fetchPlaylistDetails(playlistId);
      } else {
        setError('Invalid YouTube playlist URL or ID');
      }
    } else {
      // Video mode - only search for videos
      const videoId = extractVideoId(trimmedUrl);
      if (videoId) {
        fetchVideoDetails(videoId);
      } else {
        setError('Invalid YouTube video URL or ID');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const focusInput = () => {
    inputRef?.current?.focus();
    inputRef?.current?.select();
  };

  return (
    <div className="w-full space-y-4 m-2 pr-4">
      <div className="max-w-[300px] border-none  relative bg-muted/30 rounded-xl">
        <div
          onClick={handleSearch}
          className="bg-red-500/20 p-1 rounded-full absolute text-muted-foreground left-1 top-1"
        >
          {loading ? (
            <Loader2 className="text-primary animate-spin" />
          ) : (
            <Link2 className="text-red-500 h-4 " />
          )}
        </div>
        <Input
          ref={inputRef}
          onClick={focusInput}
          disabled={loading}
          className="w-full rounded-xl bg-transparent border-none pl-10 h-8"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Paste YouTube ${playlist ? 'playlist' : 'video'} URL or ID...`}
        />
      </div>

      {error && (
        <div className="relative flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button className='cursor-pointer absolute -top-0.5 -right-0.5 rounded-full h-3 w-3 border-white/40 border-[1px] bg-white/10 backdrop-blur-md items-center flex flex-col' onClick={() => reset()}><X className='text-white/40' size={10} /> </button>
        </div>
      )}

      {videoResult && (
        <div className="relative flex justify-center p-4 bg-muted/50 rounded-lg">
          <YoutubeVideoResult result={videoResult} currentDir={currentDir} />
          <button className='cursor-pointer absolute -top-0.5 -right-0.5 rounded-full h-3 w-3 border-white/40 border-[1px] bg-white/10 backdrop-blur-md items-center flex flex-col' onClick={() => reset()}><X className='text-white/40' size={10} /> </button>
        </div>
      )}

    </div>
  );
};

export default YoutubeVideoURLSearch;
