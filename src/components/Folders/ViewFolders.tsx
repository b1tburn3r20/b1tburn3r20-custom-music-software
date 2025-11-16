import { useDirectoryStore } from '@/stores/useDirectoryStore';
import ChangeRootDir from './ChangeRootDir';
import Playlist from "./Playlist";
import NewPlaylist from './NewPlaylist';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';
import { useState, useMemo } from 'react';

const ViewFolders = () => {
  const dirData = useDirectoryStore((f) => f.dirData);
  const currentDir = useDirectoryStore((f) => f.currentDir);
  const [filter, setFilter] = useState("");

  console.log('[ViewFolders] Rendering, dirData length:', dirData?.length);
  console.log('[ViewFolders] currentDir:', currentDir?.path);

  const sortedDirData = useMemo(() => {
    const sorted = dirData?.sort((a, b) => a.name.localeCompare(b.name)) || [];
    console.log('[ViewFolders] sortedDirData computed:', sorted.length, 'items');
    return sorted;
  }, [dirData]);

  const filteredPlaylists = useMemo(() => {
    if (!filter) {
      console.log('[ViewFolders] No filter, returning all sorted data');
      return sortedDirData;
    }
    const filtered = sortedDirData.filter((playlist) =>
      playlist.name.toLowerCase().includes(filter.toLowerCase())
    );
    console.log('[ViewFolders] Filtered to', filtered.length, 'items');
    return filtered;
  }, [filter, sortedDirData]);

  return (
    <div className="min-w-[40vh] bg-background/40 h-full flex flex-col">
      <div className='h-full bg-black/50 flex flex-col overflow-hidden'>
        {!dirData || dirData.length === 0 ? (
          <div className="flex items-center justify-between p-2">
            <div className='flex gap-8 items-center justify-between w-full rounded-lg'>
              <div className='flex gap-1 items-center'>
                <div className='h-14 w-14  rounded-full'>
                  <img className='p-2' src='/images/LILGAY.svg' alt="Logo" />
                </div>
                <div>
                  <div className='whitespace-nowrap font-bold'>B1tburn3r20</div>
                  <div className='text-muted-foreground'>Music</div>
                </div>
              </div>
              <div className='flex gap-2 items-center'>
                <ChangeRootDir />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between shrink-0">
              <div className='flex gap-8 items-center justify-between p-2 w-full rounded-lg'>
                <div className='flex gap-1 items-center'>
                  <div className='h-14 w-14  rounded-full'>
                    <img className='p-2' src='/images/LILGAY.svg' alt="Logo" />
                  </div>
                  <div>
                    <div className='whitespace-nowrap font-bold'>B1tburn3r20</div>
                    <div className='text-muted-foreground'>Music</div>
                  </div>
                </div>
                <div className='flex gap-2 items-center'>
                  <ChangeRootDir />
                </div>
              </div>
            </div>
            <div className='flex gap-2 items-center pl-2 pb-2 pr-4 shrink-0'>
              <div className='relative w-full'>
                <Search className='absolute text-muted-foreground left-2 top-1.5' />
                <Input
                  className='pl-10 w-full'
                  placeholder='Search playlists...'
                  onChange={(e) => setFilter(e.target.value)}
                  value={filter}
                />
              </div>
              <NewPlaylist />
            </div>
            <ScrollArea className='flex-1 min-h-0 pr-4'>
              <div className='flex flex-col pb-4'>
                {filteredPlaylists.map((item) => (
                  <Playlist
                    folder={item}
                    key={item.path}
                    isActive={currentDir?.path === item.path}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
};

export default ViewFolders;
