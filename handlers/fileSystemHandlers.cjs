const { ipcMain, dialog, app } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const mm = require('music-metadata');
const crypto = require('crypto');

const CACHE_VERSION = 4;

function getCacheFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'music-cache.json');
}
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
async function ensureThumbnailCacheDir() {
  const dir = getThumbnailCacheDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error('Error creating thumbnail cache directory:', error);
  }
}
function getThumbnailCachePath(filePath) {
  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  return path.join(getThumbnailCacheDir(), `${hash}.jpg`);
}
async function extractAndCacheThumbnail(filePath) {
  try {
    const thumbnailPath = getThumbnailCachePath(filePath);
    try {
      await fs.access(thumbnailPath);
      return thumbnailPath;
    } catch (err) {
      console.error("FAILED TO EXTRACT", err)
    }

    const metadata = await mm.parseFile(filePath);
    const common = metadata.common;

    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      if (picture.format === 'image/jpeg' || picture.format === 'image/webp' || picture.format === 'image/png') {
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
async function loadCacheFromDisk() {
  try {
    const cacheFilePath = getCacheFilePath();
    const cacheData = await fs.readFile(cacheFilePath, 'utf-8');
    const parsedCache = JSON.parse(cacheData);
    if (parsedCache.version !== CACHE_VERSION) {
      return false;
    }
    if (parsedCache.songCache) {
      songCache = parsedCache.songCache;
    }

    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.info('No cache file found, will create on first build');
    } else {
      console.error('Error loading cache from disk:', error);
    }
    return false;
  }
}

async function saveCacheToDisk() {
  try {
    const cacheFilePath = getCacheFilePath();
    const cacheData = {
      version: CACHE_VERSION,
      songCache: songCache,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving cache to disk:', error);
    return false;
  }
}

async function buildSongCache(rootDir) {

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

  await saveCacheToDisk();


  return songCache;
}

async function addSongToCache(filePath, rootDir) {
  try {
    const metadata = await extractMp3Metadata(filePath);
    const fileName = path.basename(filePath);

    const newSong = {
      name: fileName,
      path: filePath,
      metadata: metadata
    };
    if (songCache.rootDir && filePath.startsWith(songCache.rootDir)) {
      const existingIndex = songCache.songs.findIndex(s => s.path === filePath);
      if (existingIndex >= 0) {
        songCache.songs[existingIndex] = newSong;
      } else {
        songCache.songs.push(newSong);
      }
      songCache.lastUpdated = Date.now();
    }
    await saveCacheToDisk();
    return true;
  } catch (error) {
    console.error('Error adding song to cache:', error);
    return false;
  }
}

async function removeSongFromCache(filePath) {
  try {
    if (songCache.rootDir && filePath.startsWith(songCache.rootDir)) {
      songCache.songs = songCache.songs.filter(s => s.path !== filePath);
      songCache.lastUpdated = Date.now();
    }
    const thumbnailPath = getThumbnailCachePath(filePath);
    try {
      await fs.unlink(thumbnailPath);
    } catch (error) {
      console.error("FAILED TO REMOVE FROM CACHE", error)
    }
    await saveCacheToDisk();
    return true;
  } catch (error) {
    console.error('Error removing song from cache:', error);
    return false;
  }
}
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
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error updating song in cache:', error);
    return false;
  }
}
async function invalidateCache() {
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
loadCacheFromDisk();

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
  ipcMain.handle('get-artist-by-name', getArtistByName);
}
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
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
async function searchSongs(event, { rootDir, query = '', forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }
    if (!query || query.trim() === '') {
      const randomSongs = shuffleArray(songCache.songs).slice(0, 48);
      return {
        success: true,
        songs: randomSongs,
        total: songCache.songs.length,
        cacheAge: songCache.lastUpdated ? Date.now() - songCache.lastUpdated : null
      };
    }

    const searchWords = searchTerm.split(/\s+/);

    const results = songCache.songs.filter(song => {
      const combined = [
        song.name ?? '',
        song.metadata?.title ?? '',
        song.metadata?.artist ?? '',
        song.metadata?.album ?? '',
        song.metadata?.genre ?? ''
      ].join(' ').toLowerCase();

      return searchWords.every(word => combined.includes(word));
    }); return {
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
async function handleAddSongToCache(event, { filePath, rootDir }) {
  return await addSongToCache(filePath, rootDir);
}


async function handleUpdateSongInCache(event, { filePath }) {
  return await updateSongInCache(filePath);
}
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
async function getThumbnail(event, thumbnailUrl) {
  try {
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
  try {
    await fs.unlink(filePath);
    await removeSongFromCache(filePath);
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

async function extractMp3Metadata(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    const common = metadata.common;
    const format = metadata.format;
    const thumbnailPath = await extractAndCacheThumbnail(filePath);

    return {
      title: common.title || path.basename(filePath, '.mp3'),
      artist: common.artist || common.artists?.[0] || 'Unknown Artist',
      album: common.album || null,
      duration: format.duration || 0,
      durationFormatted: formatDuration(format.duration || 0),
      year: common.year || null,
      genre: common.genre?.[0] || null,
      thumbnail: thumbnailPath ? `file://${thumbnailPath}` : null,
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
    const artistSet = new Set();
    const albumReleaseDates = [];
    let albumThumbnail = null;
    albumSongs.forEach(song => {
      const artist = song.metadata?.artist;
      if (artist) {
        artist.split(/,|&|\bfeat\.?\b|\band\b/).map(a => a.trim()).filter(Boolean).forEach(a => artistSet.add(a));
      }
      const year = song.metadata?.year;
      if (year && !albumReleaseDates.includes(year)) {
        albumReleaseDates.push(year);
      }
      if (!albumThumbnail && song.metadata?.thumbnail) {
        albumThumbnail = song.metadata.thumbnail;
      }
    });
    return {
      success: true,
      album_name: currentSong.metadata.album,
      album_release_date: albumReleaseDates,
      album_artists: [...artistSet],
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
      const artist = song.metadata?.artist;
      if (artist) {
        artist.split(/,|&|\bfeat\.?\b|\band\b/).map(a => a.trim()).filter(Boolean).forEach(a => {
          if (!album.album_artist_name.includes(a)) {
            album.album_artist_name.push(a);
          }
        });
      }
      const year = song.metadata?.year;
      if (year && !album.album_release_date.includes(year)) {
        album.album_release_date.push(year);
      }
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
            song_paths: [],
            songs: []
          });
        }

        const artistData = artistsMap.get(artistKey);

        if (!artistData.song_paths.includes(song.path)) {
          artistData.song_paths.push(song.path);
          artistData.songs.push(song);
        }

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

    const currentArtists = artistName
      .split(/,|&|\bfeat\.?\b|\band\b/)
      .map(a => a.trim())
      .filter(Boolean);

    const artistSongs = songCache.songs.filter(song => {
      const songArtist = song.metadata?.artist?.toLowerCase() || '';

      if (!songArtist || songArtist === 'unknown artist') {
        return false;
      }

      const songArtists = songArtist
        .split(/,|&|\bfeat\.?\b|\band\b/)
        .map(a => a.trim())
        .filter(Boolean);

      return currentArtists.some(ca =>
        songArtists.some(sa =>
          sa === ca || sa.includes(ca) || ca.includes(sa)
        )
      );
    });

    const artistAlbums = [];
    const processedAlbums = new Set();

    for (const song of artistSongs) {
      const albumName = song.metadata?.album?.toLowerCase();

      if (!albumName || albumName === 'unknown album' || processedAlbums.has(albumName)) {
        continue;
      }

      const albumSongs = songCache.songs.filter(s => {
        const sAlbum = s.metadata?.album?.toLowerCase();
        return sAlbum && sAlbum === albumName;
      });

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

      const albumArtistsSet = new Set();
      const albumReleaseDates = [];
      let albumThumbnail = null;

      albumSongs.forEach(s => {
        const artist = s.metadata?.artist;
        if (artist) {
          artist.split(/,|&|\bfeat\.?\b|\band\b/).map(a => a.trim()).filter(Boolean).forEach(a => albumArtistsSet.add(a));
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
        album_artists: [...albumArtistsSet],
        album_thumbnail: albumThumbnail,
        album_songs: albumSongs
      });
    }

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
      artist_songs: artistSongs,
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

async function getArtistByName(event, { rootDir, artistName = '', forceRefresh = false }) {
  try {
    if (forceRefresh || songCache.rootDir !== rootDir || songCache.songs.length === 0) {
      await buildSongCache(rootDir);
    }

    if (!artistName || artistName.toLowerCase() === 'unknown artist') {
      return {
        success: false,
        error: 'No artist name provided'
      };
    }

    const normalizedInput = artistName.toLowerCase().trim();

    const matchingSong = songCache.songs.find(song => {
      const songArtist = song.metadata?.artist?.toLowerCase() || '';
      const songArtists = songArtist
        .split(/,|&|\bfeat\.?\b|\band\b/)
        .map(a => a.trim())
        .filter(Boolean);

      return songArtists.some(sa =>
        sa === normalizedInput || sa.includes(normalizedInput) || normalizedInput.includes(sa)
      );
    });

    if (!matchingSong) {
      return {
        success: false,
        error: `Artist "${artistName}" not found in cache`
      };
    }

    return await getArtist(event, { rootDir, path: matchingSong.path, forceRefresh: false });

  } catch (error) {
    console.error('Error getting artist by name:', error);
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
  getArtists,
  getArtistByName
};
