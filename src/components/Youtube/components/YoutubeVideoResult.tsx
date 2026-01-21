import { useState } from 'react';
import { Check, Loader2, Plus, Play } from 'lucide-react';
import type { YoutubeDetailsResult } from '@/types/YoutubeTypes';
import type { FolderDetails } from '@/types/DirectoryTypes';
import { useDirectoryStore } from '@/stores/useDirectoryStore';

const YoutubeVideoResult = ({
  result,
  currentDir
}: {
  result: YoutubeDetailsResult;
  currentDir: FolderDetails | null;
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  // const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);

  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir);
  const handleDownload = async () => {
    if (!currentDir) {
      setError('Please select a folder first');
      return;
    }
    setDownloading(true);
    setError(null);

    let cleanup = null;

    try {
      cleanup = window.electron.onDownloadProgress((data) => {
        if (data.videoId === result.id) {
          // setProgress(parseFloat(data.percent));
        }
      });

      const response = await window.electron.downloadYoutube({
        videoId: result.id,
        title: result.title,
        savePath: currentDir.path
      });

      if (response.success) {
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 3000);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.toString() || 'Failed to download video');
    } finally {
      if (cleanup) cleanup();
      setDownloading(false);
    }
  };

  if (result?.lengthSeconds < 70) {
    return null;
  }

  return (
    <div className="bg-secondary/50 flex flex-col p-2 justify-center items-center rounded-3xl w-[260px]">
      <div title={result.title} className="p-3 max-w-full">
        <span className="block text-xs font-semibold ">
          {result.title}
        </span>
      </div>
      <div className="relative flex w-full justify-center items-center">
        {showEmbed && result.embeddable ? (
          <iframe
            className="rounded-t-3xl"
            width={240}
            height={240}
            src={`https://www.youtube.com/embed/${result.id}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />) : (
          <>
            <img
              className="rounded-t-3xl"
              width={240}
              height={240}
              src={result.thumbnail}
              alt={result.title}
            />
            {result.embeddable && (
              <button
                onClick={() => setShowEmbed(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 rounded-t-3xl transition-colors group"
              >
                <div className="bg-primary/80 rounded-full p-3 group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-muted" />
                </div>
              </button>
            )}
          </>
        )}
      </div>
      <div className="w-[240px] mx-2 hover:bg-accent rounded-b-3xl">
        <div className="flex items-center">
          <button
            onClick={handleDownload}
            className='w-full cursor-pointer rounded-t-none justify-center items-center flex gap-2 p-2 rounded-b-3xl text-center'
            disabled={downloading || downloaded}
          >
            {downloading ? (
              <div className='text-center w-full justify-center flex gap-1 items-center text-xs'>
                <span className='animate-pulse'>Saving...</span>
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : downloaded ? (
              <div className='text-center w-full justify-center flex gap-1 items-center text-xs'>
                <Check className="w-4 h-4" />
                <span className="text-sm">Saved!</span>
              </div>
            ) : (
              <div className='text-center w-full justify-center flex gap-1 items-center text-xs'>
                <Plus className="w-4 h-4" />
                <span className="text-sm"> {currentDir?.playlistName}</span>
              </div>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-500">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default YoutubeVideoResult;
