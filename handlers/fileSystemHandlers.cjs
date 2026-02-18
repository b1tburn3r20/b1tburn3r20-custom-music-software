const { ipcMain, dialog, app } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const mm = require('music-metadata');
const crypto = require('crypto');

// ============================================================================
// CACHE SYSTEM WITH PERSISTENT JSON STORAGE AND THUMBNAIL EXTRACTION
// ============================================================================
const CACHE_VERSION = 4; // Incremented for thumbnail cache directory

// Get cache file path in user data directory
function getCacheFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'music-cache.json');
}

// Get thumbnail cache directory
function getThumbnailCacheDir() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'thumbnails');
}

let songCache = {
  version: CACHE_VERSION,
  rootDir: null,
  songs: [],
  lastUpdated: null
};

// Ensure thumbnail cache directory exists
async function ensureThumbnailCacheDir() {
  const dir = getThumbnailCacheDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error('Error creating thumbnail cache directory:', error);
  }
}

/**
 * Generate a consistent hash for a file path to use as thumbnail filename
 */
function getThumbnailCachePath(filePath) {
  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  return path.join(getThumbnailCacheDir(), `${hash}.jpg`);
}

/**
 * Extract and cache thumbnail from MP3 file
 */
async function extractAndCacheThumbnail(filePath) {
  try {
    const thumbnailPath = getThumbnailCachePath(filePath);

    // Check if thumbnail already cached
    try {
      await fs.access(thumbnailPath);
      return thumbnailPath; // Already cached
    } catch {
      // Not cached, extract it
    }

    const metadata = await mm.parseFile(filePath);
    const common = metadata.common;

    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      if (picture.format === 'image/jpeg' || picture.format === 'image/webp' || picture.format === 'image/png') {
        // Save thumbnail to cache directory
        await fs.writeFile(thumbnailPath, picture.data);
        return thumbnailPath;
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting thumbnail:', error);
    return null;
  }
}

/**
 * Load cache from disk
 */
async function loadCacheFromDisk() {
  try {
    const cacheFilePath = getCacheFilePath();
    const cacheData = await fs.readFile(cacheFilePath, 'utf-8');
    const parsedCache = JSON.parse(cacheData);

    // Validate cache version
    if (parsedCache.version !== CACHE_VERSION) {
      return false;
    }

    // Load song cache
    if (parsedCache.songCache) {
      songCache = parsedCache.songCache;
    }

    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No cache file found, will create on first build');
    } else {
      console.error('Error loading cache from disk:', error);
    }
    return false;
  }
}

/**
 * Save cache to disk
 */
async function saveCacheToDisk() {
  try {
    const cacheFilePath = getCacheFilePath();
    const cacheData = {
      version: CACHE_VERSION,
      songCache: songCache,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log('Cache saved to disk');
    return true;
  } catch (error) {
    console.error('Error saving cache to disk:', error);
    return false;
  }
}

/**
 * Build the song cache by scanning the root music folder
 */
async function buildSongCache(rootDir) {
  const startTime = Date.now();

  await ensureThumbnailCacheDir();

  const songs = [];
  const mp3Files = await getMp3Files(rootDir);

  for (const mp3File of mp3Files) {
    const filePath = path.join(rootDir, mp3File);
    const metadata = await extractMp3Metadata(filePath);

    songs.push({
      name: mp3File,
      path: filePath,
      metadata: metadata
    });
  }

  songCache = {
    version: CACHE_VERSION,
    rootDir: rootDir,
    songs: songs,
    lastUpdated: Date.now()
  };

  // Save to disk
  await saveCacheToDisk();

  const duration = Date.now() - startTime;
  console.log(`Song cache built: ${songs.length} songs in ${duration}ms`);

  return songCache;
}

/**
 * Add a single song to the cache (called after download)
 */
async function addSongToCache(filePath, rootDir) {
  try {
    // Extract metadata for the new song
    const metadata = await extractMp3Metadata(filePath);
    const fileName = path.basename(filePath);

    const newSong = {
      name: fileName,
      path: filePath,
      metadata: metadata
    };

    // Add to song cache if it exists for this root
    if (songCache.rootDir && filePath.startsWith(songCache.rootDir)) {
      // Check if song already exists
      const existingIndex = songCache.songs.findIndex(s => s.path === filePath);
      if (existingIndex >= 0) {
        songCache.songs[existingIndex] = newSong;
      } else {
        songCache.songs.push(newSong);
      }
      songCache.lastUpdated = Date.now();
    }

    // Save updated cache to disk
    await saveCacheToDisk();

    console.log(`Added song to cache: ${fileName}`);
    return true;
  } catch (error) {
    console.error('Error adding song to cache:', error);
    return false;
  }
}

/**
 * Remove a song from the cache (called after deletion)
 */
async function removeSongFromCache(filePath) {
  try {
    // Remove from song cache
    if (songCache.rootDir && filePath.startsWith(songCache.rootDir)) {
      songCache.songs = songCache.songs.filter(s => s.path !== filePath);
      songCache.lastUpdated = Date.now();
    }

    // Also remove cached thumbnail
    const thumbnailPath = getThumbnailCachePath(filePath);
    try {
      await fs.unlink(thumbnailPath);
    } catch (error) {
      // Thumbnail might not exist, ignore
    }

    // Save updated cache to disk
    await saveCacheToDisk();

    console.log(`Removed song from cache: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error removing song from cache:', error);
    return false;
  }
}

/**
 * Update a song in the cache (for metadata changes)
 */
async function updateSongInCache(filePath) {
  try {
    if (!songCache.rootDir || !filePath.startsWith(songCache.rootDir)) {
      return false;
    }

    const metadata = await extractMp3Metadata(filePath);
    const fileName = path.basename(filePath);

    const songIndex = songCache.songs.findIndex(s => s.path === filePath);
    if (songIndex >= 0) {
      songCache.songs[songIndex] = {
        name: fileName,
        path: filePath,
        metadata: metadata
      };
      songCache.lastUpdated = Date.now();
      await saveCacheToDisk();
      console.log(`Updated song in cache: ${fileName}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error updating song in cache:', error);
    return false;
  }
}

/**
 * Invalidate cache
 */
async function invalidateCache() {
  console.log('Invalidating song cache');

  // Clear thumbnail cache directory
  try {
    const thumbnailDir = getThumbnailCacheDir();
    const files = await fs.readdir(thumbnailDir);
    await Promise.all(files.map(file => fs.unlink(path.join(thumbnailDir, file))));
  } catch (error) {
    console.error('Error clearing thumbnail cache:', error);
  }

  songCache.songs = [];
  songCache.lastUpdated = null;
  await saveCacheToDisk();
}

// Load cache on module load
loadCacheFromDisk();

// ============================================================================
// IPC HANDLERS REGISTRATION
// ============================================================================
function registerFileSystemHandlers() {
  ipcMain.handle('select-folder', selectFolder);
  ipcMain.handle('read-folder', readFolder);
  ipcMain.handle('get-song-cache', getLightweightSongIndex);
  ipcMain.handle('get-all-songs', getAllSongs);
  ipcMain.handle('delete-file', deleteFile);
  ipcMain.handle('get-song-audio', getSongAudio);
  ipcMain.handle('get-thumbnail', getThumbnail);
  ipcMain.handle('search-songs', searchSongs);
  ipcMain.handle('get-song-queue', getSongQueue);
  ipcMain.handle('get-song-by-path', getSongByPath);
  ipcMain.handle('rebuild-cache', rebuildCache);
  ipcMain.handle('get-cache-stats', getCacheStats);
  ipcMain.handle('add-song-to-cache', handleAddSongToCache);
  ipcMain.handle('update-song-in-cache', handleUpdateSongInCache);
  ipcMain.handle('get-album', getAlbum);
  ipcMain.handle('get-albums', getAlbums);
  ipcMain.handle('get-artist', getArtist);
  ipcMain.handle('get-artists', getArtists);
}

// ============================================================================
// SEARCH AND RETRIEVAL FUNCTIONALITY
// ============================================================================

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get all songs from the root directory
 */
async function getAllSongs(event, { rootDir, forceRefresh = false, limit = null }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    const songs = limit ? songCache.songs.slice(0, limit) : songCache.songs;

    return {
      success: true,
      songs: songs,
      total: songCache.songs.length,
      cacheAge: songCache.lastUpdated ? Date.now() - songCache.lastUpdated : null
    };
  } catch (error) {
    console.error('Error getting all songs:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search for songs with caching
 */
async function searchSongs(event, { rootDir, query = '', forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    // Return random selection if no query
    if (!query || query.trim() === '') {
      const randomSongs = shuffleArray(songCache.songs).slice(0, 48);
      return {
        success: true,
        songs: randomSongs,
        total: songCache.songs.length,
        cacheAge: songCache.lastUpdated ? Date.now() - songCache.lastUpdated : null
      };
    }

    const searchTerm = query.toLowerCase().trim();
    const results = songCache.songs.filter(song => {
      return (
        song.name.toLowerCase().includes(searchTerm) ||
        song.metadata.title.toLowerCase().includes(searchTerm) ||
        song.metadata.artist.toLowerCase().includes(searchTerm) ||
        song.metadata.album.toLowerCase().includes(searchTerm) ||
        (song.metadata.genre && song.metadata.genre.toLowerCase().includes(searchTerm))
      );
    });

    return {
      success: true,
      songs: results.slice(0, 48),
      total: results.length,
      query: query,
      cacheAge: songCache.lastUpdated ? Date.now() - songCache.lastUpdated : null
    };
  } catch (error) {
    console.error('Error searching songs:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
async function getSongQueue(event, { rootDir, path = "", songsToOmit = [] }) {
  try {
    const currentSong = songCache.songs.find(song => song.path === path);
    if (!currentSong) {
      return {
        success: false,
        error: 'Current song not found in cache'
      };
    }

    const currentArtist = currentSong.metadata?.artist?.toLowerCase() || '';

    let excludePaths = new Set([path, ...songsToOmit]);
    const availableSongs = songCache.songs.filter(song => !excludePaths.has(song.path));

    if (availableSongs.length === 0) {
      return {
        success: true,
        songs: []
      };
    }

    const sameArtistSongs = [];
    const otherArtistSongs = [];

    availableSongs.forEach(song => {
      const songArtist = song.metadata?.artist?.toLowerCase() || '';

      const currentArtists = currentArtist.split(/,|&|\bfeat\.?\b|\band\b/).map(a => a.trim()).filter(Boolean);
      const songArtists = songArtist.split(/,|&|\bfeat\.?\b|\band\b/).map(a => a.trim()).filter(Boolean);

      const hasCommonArtist = currentArtists.some(ca =>
        songArtists.some(sa => sa === ca || sa.includes(ca) || ca.includes(sa))
      );

      if (hasCommonArtist) {
        sameArtistSongs.push(song);
      } else {
        otherArtistSongs.push(song);
      }
    });
    const shuffledSameArtist = shuffleArray(sameArtistSongs);
    const shuffledOtherArtist = shuffleArray(otherArtistSongs);
    const combinedPool = [...shuffledSameArtist, ...shuffledOtherArtist];
    const selectedSongs = combinedPool.slice(0, 15);
    if (!songsToOmit.length) {
      selectedSongs.unshift(currentSong)
    }
    return {
      success: true,
      songs: selectedSongs,
    };
  } catch (error) {
    console.error('Error getting song queue:', error);
    return {
      success: false,
      error: error.message
    };
  }
} async function getSongByPath(event, { rootDir, path = '', forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }
    const results = songCache.songs.find(song => {
      return (
        song.path === path
      );
    });

    return {
      song: results
    };
  } catch (error) {
    console.error('Error searching songs:', error);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Manually rebuild cache
 */
async function rebuildCache(event, { rootDir }) {
  try {
    await buildSongCache(rootDir);

    return {
      success: true,
      songs: {
        count: songCache.songs.length,
        lastUpdated: songCache.lastUpdated
      }
    };
  } catch (error) {
    console.error('Error rebuilding cache:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  return {
    songs: {
      rootDir: songCache.rootDir,
      count: songCache.songs.length,
      lastUpdated: songCache.lastUpdated,
      age: songCache.lastUpdated ? Date.now() - songCache.lastUpdated : null
    },
    cacheFilePath: getCacheFilePath(),
    thumbnailCacheDir: getThumbnailCacheDir()
  };
}

/**
 * IPC handler for adding song to cache
 */
async function handleAddSongToCache(event, { filePath, rootDir }) {
  return await addSongToCache(filePath, rootDir);
}

/**
 * IPC handler for updating song in cache
 */
async function handleUpdateSongInCache(event, { filePath }) {
  return await updateSongInCache(filePath);
}

// ============================================================================
// FILE SYSTEM OPERATIONS
// ============================================================================

/**
 * Get song audio data
 */
async function getSongAudio(event, filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:audio/mp3;base64,${base64}`;
    return { success: true, dataUrl };
  } catch (err) {
    console.error('Error reading song:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get thumbnail - returns file:// URL to cached thumbnail
 */
async function getThumbnail(event, thumbnailUrl) {
  try {
    // If already a file path, verify it exists
    if (thumbnailUrl.startsWith('file://')) {
      const filePath = thumbnailUrl.replace('file://', '');
      await fs.access(filePath);
      return { success: true, url: thumbnailUrl };
    }

    return { success: false, error: 'Invalid thumbnail path' };
  } catch (error) {
    console.error('Error accessing thumbnail:', error);
    return { success: false, error: error.message };
  }
}

async function selectFolder() {
  return await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
}

async function readFolder(event, folderPath) {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    const itemsWithMetadata = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(folderPath, item.name);
        const node = {
          name: item.name,
          isDirectory: item.isDirectory(),
          path: fullPath
        };

        if (!item.isDirectory() && item.name.toLowerCase().endsWith('.mp3')) {
          node.metadata = await extractMp3Metadata(fullPath);
        }

        return node;
      })
    );

    return itemsWithMetadata;
  } catch (error) {
    console.error(`Error reading folder ${folderPath}:`, error);
    return [];
  }
}

async function deleteFile(event, filePath) {
  console.log("Got this file path", filePath);
  try {
    await fs.unlink(filePath);

    // Remove from cache
    await removeSongFromCache(filePath);

    // Notify renderer
    event.sender.send("song-deleted", {
      filePath: filePath,
      success: true
    });

    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getMp3Files(dirPath) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items
      .filter(item => !item.isDirectory() && item.name.toLowerCase().endsWith('.mp3'))
      .map(item => item.name);
  } catch (error) {
    console.error(`Error reading MP3s in ${dirPath}:`, error);
    return [];
  }
}

/**
 * Extract MP3 metadata and cache thumbnail
 * Thumbnails are extracted once and saved to disk, then referenced via file:// URLs
 */
async function extractMp3Metadata(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    const common = metadata.common;
    const format = metadata.format;

    // Extract and cache thumbnail
    const thumbnailPath = await extractAndCacheThumbnail(filePath);

    return {
      title: common.title || path.basename(filePath, '.mp3'),
      artist: common.artist || common.artists?.[0] || 'Unknown Artist',
      album: common.album || null,
      duration: format.duration || 0,
      durationFormatted: formatDuration(format.duration || 0),
      year: common.year || null,
      genre: common.genre?.[0] || null,
      thumbnail: thumbnailPath ? `file://${thumbnailPath}` : null, // file:// URL to cached thumbnail
      uploader: common.artist || 'Unknown',
      channel: common.albumartist || common.artist || 'Unknown',
      description: common.comment?.[0] || '',
      viewCount: 0,
      likeCount: 0,
      uploadDate: common.date || '',
    };
  } catch (error) {
    console.error(`Error reading metadata from ${filePath}:`, error.message);
    return {
      title: path.basename(filePath, '.mp3'),
      artist: 'Unknown Artist',
      album: null,
      duration: 0,
      durationFormatted: '0:00',
      year: null,
      genre: null,
      thumbnail: null,
      uploader: 'Unknown',
      channel: 'Unknown',
      description: '',
      viewCount: 0,
      likeCount: 0,
      uploadDate: '',
    };
  }
}
async function getLightweightSongIndex(event, { rootDir, forceRefresh = false }) {
  console.log("Being ran with ", rootDir)
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    const lightweightSongs = songCache.songs.map(song => ({
      title: song.metadata?.title || song.name.replace(/\.mp3$/i, ''),
      artist: song.metadata?.artist?.toLowerCase() || 'Unknown Artist',
      thumbnail: song.metadata?.thumbnail || null,
      path: song.path || 'Unknown Artist',
    }));

    return {
      songs: lightweightSongs,
      // total: lightweightSongs.length,
      // cacheAge: songCache.lastUpdated ? Date.now() - songCache.lastUpdated : null
    };
  } catch (error) {
    console.error('Error getting lightweight song index:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getSongCacheData() {
  return songCache;
}


async function getAlbum(event, { rootDir, path = '', forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    const currentSong = songCache.songs.find(song => song.path === path);

    if (!currentSong) {
      return {
        success: false,
        error: 'Song not found in cache'
      };
    }

    const albumName = currentSong.metadata?.album?.toLowerCase();

    if (!albumName) {
      return {
        success: true,
        songs: [],
        album: null,
        message: 'No album metadata found for this song'
      };
    }

    const albumSongs = songCache.songs.filter(song => {
      const songAlbum = song.metadata?.album?.toLowerCase();
      return songAlbum && songAlbum === albumName;
    });

    // Aggregate album metadata
    const albumArtists = [];
    const albumReleaseDates = [];
    let albumThumbnail = null;

    albumSongs.forEach(song => {
      // Add artist if not already included
      const artist = song.metadata?.artist;
      if (artist && !albumArtists.includes(artist)) {
        albumArtists.push(artist);
      }

      // Add release date if not already included
      const year = song.metadata?.year;
      if (year && !albumReleaseDates.includes(year)) {
        albumReleaseDates.push(year);
      }

      // Update thumbnail if we don't have one yet
      if (!albumThumbnail && song.metadata?.thumbnail) {
        albumThumbnail = song.metadata.thumbnail;
      }
    });

    return {
      success: true,
      album_name: currentSong.metadata.album,
      album_release_date: albumReleaseDates,
      album_artists: albumArtists,
      album_thumbnail: albumThumbnail,
      album_songs: albumSongs
    };
  } catch (error) {
    console.error('Error getting album:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all albums with aggregated metadata
 */
async function getAlbums(event, { rootDir, forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    const albumsMap = new Map();

    songCache.songs.forEach(song => {
      const albumName = song.metadata?.album;

      if (!albumName || albumName.toLowerCase() === 'unknown album') {
        return;
      }

      const albumKey = albumName.toLowerCase();

      if (!albumsMap.has(albumKey)) {
        albumsMap.set(albumKey, {
          album_name: albumName,
          album_artist_name: [],
          album_release_date: [],
          thumbnail: song.metadata?.thumbnail || null,
          song_paths: [],
          song_count: 0
        });
      }

      const album = albumsMap.get(albumKey);
      album.song_paths.push(song.path);
      album.song_count++;

      // Add artist if not already included
      const artist = song.metadata?.artist;
      if (artist && !album.album_artist_name.includes(artist)) {
        album.album_artist_name.push(artist);
      }

      // Add release date if not already included
      const year = song.metadata?.year;
      if (year && !album.album_release_date.includes(year)) {
        album.album_release_date.push(year);
      }

      // Update thumbnail if current song has one and album doesn't
      if (!album.thumbnail && song.metadata?.thumbnail) {
        album.thumbnail = song.metadata.thumbnail;
      }
    });

    const albums = Array.from(albumsMap.values());

    return {
      success: true,
      albums: albums,
      total: albums.length
    };
  } catch (error) {
    console.error('Error getting albums:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function getArtists(event, { rootDir, forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    const artistsMap = new Map();

    songCache.songs.forEach(song => {
      const artistName = song.metadata?.artist;

      if (!artistName || artistName.toLowerCase() === 'unknown artist') {
        return;
      }

      // Split artists by common separators
      const artists = artistName
        .split(/,|&|\bfeat\.?\b|\band\b/)
        .map(a => a.trim())
        .filter(Boolean);

      artists.forEach(artist => {
        const artistKey = artist.toLowerCase();

        if (!artistsMap.has(artistKey)) {
          artistsMap.set(artistKey, {
            artist_name: artist,
            thumbnail: song.metadata?.thumbnail || null,
            song_paths: []
          });
        }

        const artistData = artistsMap.get(artistKey);

        // Add song path if not already included
        if (!artistData.song_paths.includes(song.path)) {
          artistData.song_paths.push(song.path);
        }

        // Update thumbnail if current song has one and artist doesn't
        if (!artistData.thumbnail && song.metadata?.thumbnail) {
          artistData.thumbnail = song.metadata.thumbnail;
        }
      });
    });

    const artists = Array.from(artistsMap.values());

    return {
      success: true,
      artists: artists,
      total: artists.length
    };
  } catch (error) {
    console.error('Error getting artists:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
async function getArtist(event, { rootDir, path = '', forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    const currentSong = songCache.songs.find(song => song.path === path);

    if (!currentSong) {
      return {
        success: false,
        error: 'Song not found in cache'
      };
    }

    const artistName = currentSong.metadata?.artist?.toLowerCase() || '';

    if (!artistName || artistName === 'unknown artist') {
      return {
        success: true,
        songs: [],
        albums: [],
        artist: null,
        message: 'No artist metadata found for this song'
      };
    }

    // Get all artists from the current song
    const currentArtists = artistName
      .split(/,|&|\bfeat\.?\b|\band\b/)
      .map(a => a.trim())
      .filter(Boolean);

    // Find all songs that feature any of these artists
    const artistSongs = songCache.songs.filter(song => {
      const songArtist = song.metadata?.artist?.toLowerCase() || '';

      if (!songArtist || songArtist === 'unknown artist') {
        return false;
      }

      const songArtists = songArtist
        .split(/,|&|\bfeat\.?\b|\band\b/)
        .map(a => a.trim())
        .filter(Boolean);

      // Check if any artist from current song appears in this song
      return currentArtists.some(ca =>
        songArtists.some(sa =>
          sa === ca || sa.includes(ca) || ca.includes(sa)
        )
      );
    });

    // Get all unique albums from these songs where ALL current artists are present
    const albumsMap = new Map();

    artistSongs.forEach(song => {
      const albumName = song.metadata?.album;

      if (!albumName || albumName.toLowerCase() === 'unknown album') {
        return;
      }

      const songArtist = song.metadata?.artist?.toLowerCase() || '';
      const songArtists = songArtist
        .split(/,|&|\bfeat\.?\b|\band\b/)
        .map(a => a.trim())
        .filter(Boolean);

      // Check if ALL current artists are present in this song (regardless of order)
      const hasAllArtists = currentArtists.every(ca =>
        songArtists.some(sa => sa === ca || sa.includes(ca) || ca.includes(sa))
      );

      // Only include albums where all artists match
      if (!hasAllArtists) {
        return;
      }

      const albumKey = albumName.toLowerCase();

      if (!albumsMap.has(albumKey)) {
        albumsMap.set(albumKey, {
          album_name: albumName,
          album_artist_name: [],
          album_release_date: [],
          thumbnail: song.metadata?.thumbnail || null,
          song_paths: [],
          song_count: 0
        });
      }

      const album = albumsMap.get(albumKey);
      album.song_paths.push(song.path);
      album.song_count++;

      // Add artist if not already included
      const artist = song.metadata?.artist;
      if (artist && !album.album_artist_name.includes(artist)) {
        album.album_artist_name.push(artist);
      }

      // Add release date if not already included
      const year = song.metadata?.year;
      if (year && !album.album_release_date.includes(year)) {
        album.album_release_date.push(year);
      }

      // Update thumbnail if current song has one and album doesn't
      if (!album.thumbnail && song.metadata?.thumbnail) {
        album.thumbnail = song.metadata.thumbnail;
      }
    });

    const albums = Array.from(albumsMap.values());

    // Get full album data for each album by calling getAlbum logic
    const artistAlbums = [];
    const processedAlbums = new Set();

    for (const song of artistSongs) {
      const albumName = song.metadata?.album?.toLowerCase();

      if (!albumName || albumName === 'unknown album' || processedAlbums.has(albumName)) {
        continue;
      }

      // Check if this album has all current artists
      const albumSongs = songCache.songs.filter(s => {
        const sAlbum = s.metadata?.album?.toLowerCase();
        return sAlbum && sAlbum === albumName;
      });

      // Check if album has all artists
      const albumHasAllArtists = albumSongs.some(s => {
        const sArtist = s.metadata?.artist?.toLowerCase() || '';
        const sArtists = sArtist.split(/,|&|\bfeat\.?\b|\band\b/).map(a => a.trim()).filter(Boolean);
        return currentArtists.every(ca =>
          sArtists.some(sa => sa === ca || sa.includes(ca) || ca.includes(sa))
        );
      });

      if (!albumHasAllArtists) {
        continue;
      }

      processedAlbums.add(albumName);

      // Build album object
      const albumArtists = [];
      const albumReleaseDates = [];
      let albumThumbnail = null;

      albumSongs.forEach(s => {
        const artist = s.metadata?.artist;
        if (artist && !albumArtists.includes(artist)) {
          albumArtists.push(artist);
        }

        const year = s.metadata?.year;
        if (year && !albumReleaseDates.includes(year)) {
          albumReleaseDates.push(year);
        }

        if (!albumThumbnail && s.metadata?.thumbnail) {
          albumThumbnail = s.metadata.thumbnail;
        }
      });

      artistAlbums.push({
        album_name: song.metadata.album,
        album_release_date: albumReleaseDates,
        album_artists: albumArtists,
        album_thumbnail: albumThumbnail,
        album_songs: albumSongs
      });
    }

    // Get artist thumbnail from first song
    let artistThumbnail = null;
    for (const song of artistSongs) {
      if (song.metadata?.thumbnail) {
        artistThumbnail = song.metadata.thumbnail;
        break;
      }
    }

    return {
      success: true,
      artist_name: currentSong.metadata.artist,
      artist_albums: artistAlbums,
      artist_thumbnail: artistThumbnail
    };
  } catch (error) {
    console.error('Error getting artist:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  registerFileSystemHandlers,
  addSongToCache,
  removeSongFromCache,
  updateSongInCache,
  invalidateCache,
  getSongCacheData,
  getAlbum,
  getAlbums,
  getArtist,
  getArtists
};
