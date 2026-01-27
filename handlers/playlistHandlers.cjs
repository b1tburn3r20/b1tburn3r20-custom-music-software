const { ipcMain, app } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const crypto = require('crypto');

const fileSystemHandler = require('./fileSystemHandlers.cjs');

// ============================================================================
// PLAYLIST CACHE SYSTEM WITH PERSISTENT JSON STORAGE
// ============================================================================

// Get playlist file path in user data directory
function getPlaylistFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'playlists.json');
}

let playlistCache = {
  playlists: [],
  lastUpdated: null
};

/**
 * Get song cache data from file system handler
 */
function getSongCache() {
  return fileSystemHandler.getSongCacheData();
}

/**
 * Resolve song paths to full song objects from cache
 */
function resolveSongsFromCache(songPaths) {
  const songCache = getSongCache();
  return songPaths
    .map(songPath => {
      const song = songCache.songs.find(s => s.path === songPath);
      return song || null;
    })
    .filter(song => song !== null); // Remove any songs that couldn't be found
}

/**
 * Load playlists from disk
 */
async function loadPlaylistsFromDisk() {
  try {
    const playlistFilePath = getPlaylistFilePath();
    const playlistData = await fs.readFile(playlistFilePath, 'utf-8');
    const parsedData = JSON.parse(playlistData);

    playlistCache = {
      playlists: parsedData.playlists || [],
      lastUpdated: Date.now()
    };

    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No playlist file found, will create on first save');
      playlistCache = {
        playlists: [],
        lastUpdated: Date.now()
      };
    } else {
      console.error('Error loading playlists from disk:', error);
    }
    return false;
  }
}

/**
 * Save playlists to disk (stores only paths to keep file size small)
 */
async function savePlaylistsToDisk() {
  try {
    const playlistFilePath = getPlaylistFilePath();
    const playlistData = {
      playlists: playlistCache.playlists,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(playlistFilePath, JSON.stringify(playlistData, null, 2), 'utf-8');
    playlistCache.lastUpdated = Date.now();
    console.log('Playlists saved to disk');
    return true;
  } catch (error) {
    console.error('Error saving playlists to disk:', error);
    return false;
  }
}

/**
 * Generate unique playlist ID
 */
function generatePlaylistId() {
  return `playlist-${crypto.randomBytes(8).toString('hex')}-${Date.now()}`;
}

// Load playlists on module load
loadPlaylistsFromDisk();

// ============================================================================
// IPC HANDLERS REGISTRATION
// ============================================================================
function registerPlaylistHandlers() {
  ipcMain.handle('get-playlists', getPlaylists);
  ipcMain.handle('create-playlist', createPlaylist);
  ipcMain.handle('update-playlist', updatePlaylist);
  ipcMain.handle('delete-playlist', deletePlaylist);
  ipcMain.handle('add-song-to-playlist', addSongToPlaylist);
  ipcMain.handle('remove-song-from-playlist', removeSongFromPlaylist);
  ipcMain.handle('get-playlist-songs', getPlaylistSongs);
}

// ============================================================================
// PLAYLIST OPERATIONS
// ============================================================================

/**
 * Get all playlists with resolved song data
 */
async function getPlaylists(event, { forceRefresh = false } = {}) {
  try {
    if (forceRefresh) {
      await loadPlaylistsFromDisk();
    }

    // Resolve songs for each playlist
    const playlistsWithSongs = playlistCache.playlists.map(playlist => ({
      ...playlist,
      songs: resolveSongsFromCache(playlist.songs),
      songCount: playlist.songs.length
    }));

    return {
      success: true,
      playlists: playlistsWithSongs,
      total: playlistCache.playlists.length,
      cacheAge: playlistCache.lastUpdated ? Date.now() - playlistCache.lastUpdated : null
    };
  } catch (error) {
    console.error('Error getting playlists:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get songs for a specific playlist
 */
async function getPlaylistSongs(event, { playlistId }) {
  try {
    const playlist = playlistCache.playlists.find(p => p.id === playlistId);

    if (!playlist) {
      return {
        success: false,
        error: 'Playlist not found'
      };
    }

    const songs = resolveSongsFromCache(playlist.songs);

    return {
      success: true,
      songs: songs,
      total: songs.length
    };
  } catch (error) {
    console.error('Error getting playlist songs:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new playlist
 */
async function createPlaylist(event, { name, description = '' }) {
  try {
    if (!name || name.trim() === '') {
      return {
        success: false,
        error: 'Playlist name is required'
      };
    }

    const newPlaylist = {
      id: generatePlaylistId(),
      name: name.trim(),
      description: description.trim(),
      created: Date.now(),
      updated: Date.now(),
      songs: [] // Array of song paths
    };

    playlistCache.playlists.push(newPlaylist);
    await savePlaylistsToDisk();

    return {
      success: true,
      playlist: {
        ...newPlaylist,
        songs: [], // Empty array of song objects
        songCount: 0
      }
    };
  } catch (error) {
    console.error('Error creating playlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update a playlist (name, description, or reorder songs)
 */
async function updatePlaylist(event, { playlistId, name, description, songs }) {
  try {
    const playlistIndex = playlistCache.playlists.findIndex(p => p.id === playlistId);

    if (playlistIndex === -1) {
      return {
        success: false,
        error: 'Playlist not found'
      };
    }

    const playlist = playlistCache.playlists[playlistIndex];

    // Update fields if provided
    if (name !== undefined) {
      playlist.name = name.trim();
    }
    if (description !== undefined) {
      playlist.description = description.trim();
    }
    if (songs !== undefined) {
      // If songs are provided as objects, extract their paths
      playlist.songs = Array.isArray(songs)
        ? songs.map(song => typeof song === 'string' ? song : song.path)
        : [];
    }

    playlist.updated = Date.now();

    await savePlaylistsToDisk();

    return {
      success: true,
      playlist: {
        ...playlist,
        songs: resolveSongsFromCache(playlist.songs),
        songCount: playlist.songs.length
      }
    };
  } catch (error) {
    console.error('Error updating playlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a playlist
 */
async function deletePlaylist(event, { playlistId }) {
  try {
    const playlistIndex = playlistCache.playlists.findIndex(p => p.id === playlistId);

    if (playlistIndex === -1) {
      return {
        success: false,
        error: 'Playlist not found'
      };
    }

    const deletedPlaylist = playlistCache.playlists.splice(playlistIndex, 1)[0];
    await savePlaylistsToDisk();

    return {
      success: true,
      deletedPlaylist: {
        ...deletedPlaylist,
        songs: resolveSongsFromCache(deletedPlaylist.songs),
        songCount: deletedPlaylist.songs.length
      }
    };
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add a song to a playlist
 */
async function addSongToPlaylist(event, { playlistId, songPath }) {
  try {
    const playlist = playlistCache.playlists.find(p => p.id === playlistId);

    if (!playlist) {
      return {
        success: false,
        error: 'Playlist not found'
      };
    }

    // Verify song exists in cache
    const songCache = getSongCache();
    const songExists = songCache.songs.some(s => s.path === songPath);

    if (!songExists) {
      return {
        success: false,
        error: 'Song not found in library'
      };
    }

    // Check if song already exists in playlist
    if (playlist.songs.includes(songPath)) {
      return {
        success: false,
        error: 'Song already in playlist'
      };
    }

    playlist.songs.push(songPath);
    playlist.updated = Date.now();

    await savePlaylistsToDisk();

    return {
      success: true,
      playlist: {
        ...playlist,
        songs: resolveSongsFromCache(playlist.songs),
        songCount: playlist.songs.length
      }
    };
  } catch (error) {
    console.error('Error adding song to playlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Remove a song from a playlist
 */
async function removeSongFromPlaylist(event, { playlistId, songPath }) {
  try {
    const playlist = playlistCache.playlists.find(p => p.id === playlistId);

    if (!playlist) {
      return {
        success: false,
        error: 'Playlist not found'
      };
    }

    const songIndex = playlist.songs.indexOf(songPath);

    if (songIndex === -1) {
      return {
        success: false,
        error: 'Song not found in playlist'
      };
    }

    playlist.songs.splice(songIndex, 1);
    playlist.updated = Date.now();

    await savePlaylistsToDisk();

    return {
      success: true,
      playlist: {
        ...playlist,
        songs: resolveSongsFromCache(playlist.songs),
        songCount: playlist.songs.length
      }
    };
  } catch (error) {
    console.error('Error removing song from playlist:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up playlists - remove songs that no longer exist in cache
 */
async function cleanupPlaylists() {
  const songCache = getSongCache();
  const validPaths = new Set(songCache.songs.map(s => s.path));

  let updated = false;

  playlistCache.playlists.forEach(playlist => {
    const originalLength = playlist.songs.length;
    playlist.songs = playlist.songs.filter(path => validPaths.has(path));

    if (playlist.songs.length !== originalLength) {
      playlist.updated = Date.now();
      updated = true;
    }
  });

  if (updated) {
    await savePlaylistsToDisk();
    console.log('Playlists cleaned up');
  }
}

module.exports = {
  registerPlaylistHandlers,
  cleanupPlaylists
};
