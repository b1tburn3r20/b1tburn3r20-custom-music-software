import { useState, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Loader2, Link2, AlertCircle, X } from "lucide-react";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import YoutubeVideoResult from "./YoutubeVideoResult";
import type { YoutubeDetailsResult } from '@/types/YoutubeTypes';

const YoutubeVideoURLSearch = () => {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<YoutubeDetailsResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentDir = useDirectoryStore((f) => f.currentDir);

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
    setError(null)
    setVideoResult(null)
  }

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
      setError('Please enter a YouTube URL or video ID');
      return;
    }

    const videoId = extractVideoId(trimmedUrl);
    if (!videoId) {
      setError('Invalid YouTube URL or video ID');
      return;
    }

    fetchVideoDetails(videoId);
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
      <div className="w-full border-none relative bg-muted/30 rounded-xl">
        <div
          onClick={handleSearch}
          className="bg-accent/50 p-2 rounded-full absolute text-muted-foreground left-2 top-2 cursor-pointer hover:bg-accent transition-colors"
        >
          {loading ? (
            <Loader2 className="text-primary animate-spin" />
          ) : (
            <Link2 className="text-primary" />
          )}
        </div>
        <Input
          ref={inputRef}
          onClick={focusInput}
          disabled={loading}
          className="w-full rounded-xl bg-transparent border-none pl-14 h-14"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL or video ID..."
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
