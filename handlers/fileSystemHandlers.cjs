const { ipcMain, dialog, app } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const mm = require('music-metadata');

// ============================================================================
// CACHE SYSTEM WITH PERSISTENT JSON STORAGE
// ============================================================================
const CACHE_VERSION = 1;

// Get cache file path in user data directory
function getCacheFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'music-cache.json');
}

let songCache = {
  version: CACHE_VERSION,
  rootDir: null,
  songs: [],
  lastUpdated: null
};

let folderTreeCache = {
  version: CACHE_VERSION,
  rootDir: null,
  folders: [],
  lastUpdated: null
};

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
      console.log('Cache version mismatch, invalidating...');
      return false;
    }

    // Load song cache
    if (parsedCache.songCache) {
      songCache = parsedCache.songCache;
      console.log(`Loaded song cache: ${songCache.songs.length} songs`);
    }

    // Load folder tree cache
    if (parsedCache.folderTreeCache) {
      folderTreeCache = parsedCache.folderTreeCache;
      console.log(`Loaded folder tree cache: ${folderTreeCache.folders.length} folders`);
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
      folderTreeCache: folderTreeCache,
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
 * Build the song cache by scanning all subfolders
 */
async function buildSongCache(rootDir) {
  console.log(`Building song cache for: ${rootDir}`);
  const startTime = Date.now();

  const songs = [];
  const folders = await fs.readdir(rootDir, { withFileTypes: true });

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;

    const folderPath = path.join(rootDir, folder.name);
    const mp3Files = await getMp3Files(folderPath);

    for (const mp3File of mp3Files) {
      const filePath = path.join(folderPath, mp3File);
      const metadata = await extractMp3Metadata(filePath);

      songs.push({
        name: mp3File,
        path: filePath,
        folderName: folder.name,
        folderPath: folderPath,
        metadata: metadata
      });
    }
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
 * Build the folder tree cache
 */
async function buildFolderTreeCache(rootDir) {
  console.log(`Building folder tree cache for: ${rootDir}`);
  const startTime = Date.now();

  const items = await fs.readdir(rootDir, { withFileTypes: true });
  const folders = [];

  for (const item of items) {
    if (!item.isDirectory()) continue;

    const fullPath = path.join(rootDir, item.name);
    const mp3Files = await getMp3Files(fullPath);
    const songCount = mp3Files.length;
    const thumbnails = songCount > 0 ? await getSampleThumbnails(mp3Files, fullPath) : [];

    folders.push({
      name: item.name,
      path: fullPath,
      songCount: songCount,
      thumbnails: thumbnails
    });
  }

  folderTreeCache = {
    version: CACHE_VERSION,
    rootDir: rootDir,
    folders: folders,
    lastUpdated: Date.now()
  };

  // Save to disk
  await saveCacheToDisk();

  const duration = Date.now() - startTime;
  console.log(`Folder tree cache built: ${folders.length} folders in ${duration}ms`);

  return folderTreeCache;
}

/**
 * Add a single song to the cache (called after download)
 */
async function addSongToCache(filePath, folderPath) {
  try {
    // Extract metadata for the new song
    const metadata = await extractMp3Metadata(filePath);
    const folderName = path.basename(folderPath);
    const fileName = path.basename(filePath);

    const newSong = {
      name: fileName,
      path: filePath,
      folderName: folderName,
      folderPath: folderPath,
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

    // Update folder tree cache
    if (folderTreeCache.rootDir && folderPath.startsWith(folderTreeCache.rootDir)) {
      const folderIndex = folderTreeCache.folders.findIndex(f => f.path === folderPath);
      if (folderIndex >= 0) {
        // Update existing folder
        const mp3Files = await getMp3Files(folderPath);
        folderTreeCache.folders[folderIndex].songCount = mp3Files.length;
        folderTreeCache.folders[folderIndex].thumbnails = await getSampleThumbnails(mp3Files, folderPath);
      } else {
        // Add new folder
        const mp3Files = await getMp3Files(folderPath);
        const songCount = mp3Files.length;
        const thumbnails = songCount > 0 ? await getSampleThumbnails(mp3Files, folderPath) : [];

        folderTreeCache.folders.push({
          name: folderName,
          path: folderPath,
          songCount: songCount,
          thumbnails: thumbnails
        });
      }
      folderTreeCache.lastUpdated = Date.now();
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
async function removeSongFromCache(filePath, folderPath) {
  try {
    // Remove from song cache
    if (songCache.rootDir && filePath.startsWith(songCache.rootDir)) {
      songCache.songs = songCache.songs.filter(s => s.path !== filePath);
      songCache.lastUpdated = Date.now();
    }

    // Update folder tree cache
    if (folderTreeCache.rootDir && folderPath.startsWith(folderTreeCache.rootDir)) {
      const folderIndex = folderTreeCache.folders.findIndex(f => f.path === folderPath);
      if (folderIndex >= 0) {
        const mp3Files = await getMp3Files(folderPath);
        folderTreeCache.folders[folderIndex].songCount = mp3Files.length;

        if (mp3Files.length > 0) {
          folderTreeCache.folders[folderIndex].thumbnails = await getSampleThumbnails(mp3Files, folderPath);
        } else {
          folderTreeCache.folders[folderIndex].thumbnails = [];
        }
      }
      folderTreeCache.lastUpdated = Date.now();
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
 * Remove a folder from the cache (called after deletion)
 */
async function removeFolderFromCache(folderPath) {
  try {
    // Remove all songs in this folder from song cache
    if (songCache.rootDir && folderPath.startsWith(songCache.rootDir)) {
      songCache.songs = songCache.songs.filter(s => !s.path.startsWith(folderPath));
      songCache.lastUpdated = Date.now();
    }

    // Remove folder from folder tree cache
    if (folderTreeCache.rootDir && folderPath.startsWith(folderTreeCache.rootDir)) {
      folderTreeCache.folders = folderTreeCache.folders.filter(f => f.path !== folderPath);
      folderTreeCache.lastUpdated = Date.now();
    }

    // Save updated cache to disk
    await saveCacheToDisk();

    console.log(`Removed folder from cache: ${folderPath}`);
    return true;
  } catch (error) {
    console.error('Error removing folder from cache:', error);
    return false;
  }
}

/**
 * Invalidate caches when files/folders change
 */
function invalidateCaches(affectedPath = null) {
  if (affectedPath) {
    // Only invalidate if the path is within our cached directories
    if (songCache.rootDir && affectedPath.startsWith(songCache.rootDir)) {
      console.log('Invalidating song cache');
      songCache.songs = [];
      songCache.lastUpdated = null;
    }
    if (folderTreeCache.rootDir && affectedPath.startsWith(folderTreeCache.rootDir)) {
      console.log('Invalidating folder tree cache');
      folderTreeCache.folders = [];
      folderTreeCache.lastUpdated = null;
    }
  } else {
    // Invalidate all caches
    songCache.songs = [];
    songCache.lastUpdated = null;
    folderTreeCache.folders = [];
    folderTreeCache.lastUpdated = null;
  }

  // Save cleared cache to disk
  saveCacheToDisk();
}

// Load cache on module load
loadCacheFromDisk();

// ============================================================================
// IPC HANDLERS REGISTRATION
// ============================================================================
function registerFileSystemHandlers() {
  ipcMain.handle('select-folder', selectFolder);
  ipcMain.handle('read-folder', readFolder);
  ipcMain.handle('read-folder-tree', readFolderTree);
  ipcMain.handle('read-folder-details', readFolderDetails);
  ipcMain.handle('create-folder', createFolder);
  ipcMain.handle('delete-folder', deleteFolder);
  ipcMain.handle('delete-file', deleteFile);
  ipcMain.handle('get-song-audio', getSongAudio);
  ipcMain.handle('search-songs', searchSongs);
  ipcMain.handle('rebuild-cache', rebuildCache);
  ipcMain.handle('get-cache-stats', getCacheStats);
  ipcMain.handle('add-song-to-cache', handleAddSongToCache);
}

// ============================================================================
// SEARCH FUNCTIONALITY
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
 * Search for songs across all subfolders with caching
 */
async function searchSongs(event, { rootDir, query = '', forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    if (!query || query.trim() === '') {
      const randomSongs = shuffleArray(songCache.songs).slice(0, 48)
      return {
        success: true,
        songs: randomSongs,
        total: songCache.songs.length,
        cacheAge: songCache.lastUpdated ? Date.now() - songCache.lastUpdated : null
      };
    }

    // Search in cache
    const searchTerm = query.toLowerCase().trim();
    const results = songCache.songs.filter(song => {
      return (
        song.name.toLowerCase().includes(searchTerm) ||
        song.metadata.title.toLowerCase().includes(searchTerm) ||
        song.metadata.artist.toLowerCase().includes(searchTerm) ||
        song.metadata.album.toLowerCase().includes(searchTerm) ||
        (song.metadata.genre && song.metadata.genre.toLowerCase().includes(searchTerm)) ||
        song.folderName.toLowerCase().includes(searchTerm)
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

/**
 * Manually rebuild caches
 */
async function rebuildCache(event, { rootDir, type = 'all' }) {
  try {
    const results = {};

    if (type === 'all' || type === 'songs') {
      await buildSongCache(rootDir);
      results.songs = {
        count: songCache.songs.length,
        lastUpdated: songCache.lastUpdated
      };
    }

    if (type === 'all' || type === 'folders') {
      await buildFolderTreeCache(rootDir);
      results.folders = {
        count: folderTreeCache.folders.length,
        lastUpdated: folderTreeCache.lastUpdated
      };
    }

    return {
      success: true,
      ...results
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
    folders: {
      rootDir: folderTreeCache.rootDir,
      count: folderTreeCache.folders.length,
      lastUpdated: folderTreeCache.lastUpdated,
      age: folderTreeCache.lastUpdated ? Date.now() - folderTreeCache.lastUpdated : null
    },
    cacheFilePath: getCacheFilePath()
  };
}

/**
 * IPC handler for adding song to cache
 */
async function handleAddSongToCache(event, { filePath, folderPath }) {
  return await addSongToCache(filePath, folderPath);
}

// ============================================================================
// FILE SYSTEM OPERATIONS
// ============================================================================

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

async function selectFolder() {
  return await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
}

async function readFolderTree(event, folderPath, useCache = true) {
  try {
    // Check if we can use cache
    if (useCache && folderTreeCache.rootDir === folderPath && folderTreeCache.folders.length > 0) {
      console.log('Using cached folder tree');
      return folderTreeCache.folders;
    }

    // Build/rebuild cache
    await buildFolderTreeCache(folderPath);
    return folderTreeCache.folders;

  } catch (error) {
    console.error(`Error reading directory ${folderPath}:`, error);
    return [];
  }
}

async function readFolderDetails(event, folderPath) {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    const songs = [];

    for (const item of items) {
      if (item.isDirectory()) continue;
      if (!item.name.toLowerCase().endsWith('.mp3')) continue;

      const fullPath = path.join(folderPath, item.name);
      const metadata = await extractMp3Metadata(fullPath);

      songs.push({
        name: item.name,
        path: fullPath,
        metadata: metadata
      });
    }

    const mp3Files = await getMp3Files(folderPath);
    const songCount = mp3Files.length;
    const thumbnails = songCount > 0 ? await getSampleThumbnails(mp3Files, folderPath) : [];

    return {
      playlistName: path.basename(folderPath),
      songs,
      path: folderPath,
      thumbnails: thumbnails
    };
  } catch (error) {
    console.error(`Error reading folder details ${folderPath}:`, error);
    return {
      songs: [],
      path: folderPath,
      error: error.message
    };
  }
}

async function readFolder(event, folderPath) {
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
}

async function createFolder(event, { parentPath, folderName }) {
  const newFolderPath = path.join(parentPath, folderName);
  try {
    await fs.mkdir(newFolderPath, { recursive: false });

    // Don't invalidate - folder is empty, no need to rebuild

    return {
      success: true,
      path: newFolderPath,
      message: 'Folder created successfully'
    };
  } catch (error) {
    if (error.code === 'EEXIST') {
      return { success: false, error: 'Folder already exists' };
    }
    return { success: false, error: error.message };
  }
}

async function deleteFile(event, filePath) {
  try {
    const folderPath = path.dirname(filePath);
    await fs.unlink(filePath);

    // Remove from cache instead of invalidating
    await removeSongFromCache(filePath, folderPath);

    const updatedFolder = await generateLightFolderData(folderPath);
    event.sender.send("download-complete", {
      folderPath: folderPath,
      updatedFolder: updatedFolder
    });

    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    return { success: false, error: error.message };
  }
}

async function deleteFolder(event, folderPath) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });

    // Remove from cache instead of invalidating
    await removeFolderFromCache(folderPath);

    event.sender.send("download-complete", {
      folderPath: folderPath,
      updatedFolder: null,
      deleted: true
    });

    return { success: true, message: 'Folder deleted successfully' };
  } catch (error) {
    console.error(`Error deleting folder ${folderPath}:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateLightFolderData(folderPath) {
  const mp3Files = await getMp3Files(folderPath);
  const songCount = mp3Files.length;
  const thumbnails = songCount > 0 ? await getSampleThumbnails(mp3Files, folderPath) : [];

  return {
    name: path.basename(folderPath),
    path: folderPath,
    songCount: songCount,
    thumbnails: thumbnails
  };
}

async function getSampleThumbnails(mp3Files, folderPath) {
  if (mp3Files.length === 0) return [];

  const total = mp3Files.length;
  const percentages = [0, 0.33, 0.66, 1];
  const uniqueThumbnails = new Set();

  for (const pct of percentages) {
    if (uniqueThumbnails.size >= 4) break;

    const index = pct === 1 ? total - 1 : Math.floor(total * pct);
    const fileName = mp3Files[index];
    const filePath = path.join(folderPath, fileName);
    const thumbnail = await extractThumbnailOnly(filePath);

    if (thumbnail) {
      uniqueThumbnails.add(thumbnail);
    }
  }

  return Array.from(uniqueThumbnails);
}

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

function uint8ArrayToBase64(uint8Array) {
  return Buffer.from(uint8Array).toString('base64');
}

async function extractThumbnailOnly(filePath) {
  try {
    const metadata = await mm.parseFile(filePath, {
      skipCovers: false,
      duration: false,
      skipPostHeaders: true
    });

    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];
      if (picture.format === 'image/jpeg' || picture.format === 'image/webp' || picture.format === "image/png") {
        const base64String = uint8ArrayToBase64(picture.data);
        return `data:${picture.format};base64,${base64String}`;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function extractMp3Metadata(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    const common = metadata.common;
    const format = metadata.format;

    let thumbnail = null;
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      if (picture.format === 'image/jpeg' || picture.format === 'image/webp' || picture.format === "image/png") {
        const base64String = uint8ArrayToBase64(picture.data);
        thumbnail = `data:${picture.format};base64,${base64String}`;
      }
    }

    return {
      title: common.title || path.basename(filePath, '.mp3'),
      artist: common.artist || common.artists?.[0] || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: format.duration || 0,
      durationFormatted: formatDuration(format.duration || 0),
      year: common.year || null,
      genre: common.genre?.[0] || null,
      thumbnail: thumbnail,
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
      album: 'Unknown Album',
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

module.exports = {
  registerFileSystemHandlers,
  addSongToCache,
  removeSongFromCache,
  removeFolderFromCache
};
