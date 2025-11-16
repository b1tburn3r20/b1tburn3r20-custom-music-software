const { ipcMain, dialog } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const mm = require('music-metadata');

/**
 * Register all file system related IPC handlers
 */
function registerFileSystemHandlers() {
  ipcMain.handle('select-folder', selectFolder);
  ipcMain.handle('read-folder', readFolder);
  ipcMain.handle('read-folder-tree', readFolderTree);
  ipcMain.handle('read-folder-details', readFolderDetails);
  ipcMain.handle('create-folder', createFolder);
  ipcMain.handle('delete-folder', deleteFolder);
  ipcMain.handle('delete-file', deleteFile);
}

ipcMain.handle('get-song-audio', async (event, filePath) => {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:audio/mp3;base64,${base64}`;
    return { success: true, dataUrl };
  } catch (err) {
    console.error('Error reading song:', err);
    return { success: false, error: err.message };
  }
});

/**
 * Open dialog to select a folder
 */
async function selectFolder() {
  return await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(uint8Array) {
  return Buffer.from(uint8Array).toString('base64');
}

/**
 * Extract ONLY thumbnail from MP3 file (optimized)
 */
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
/**
 * Get sample thumbnails for folder collage
 * Samples at 0%, 33%, 66%, 100% positions
 */
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

/**
 * Get MP3 files in a directory (non-recursive)
 */
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
 * Read folder tree - OPTIMIZED (Top level only)
 * Only returns: folder name, path, song count, and up to 4 sample thumbnails
 * Does NOT read full metadata for every song or go into subdirectories
 */
async function readFolderTree(event, folderPath) {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    const folders = [];

    for (const item of items) {
      if (!item.isDirectory()) continue;

      const fullPath = path.join(folderPath, item.name);

      // Count MP3 files in this folder only (NOT recursive)
      const mp3Files = await getMp3Files(fullPath);
      const songCount = mp3Files.length;

      // Get sample thumbnails (only if there are songs)
      const thumbnails = songCount > 0
        ? await getSampleThumbnails(mp3Files, fullPath)
        : [];

      folders.push({
        name: item.name,
        path: fullPath,
        songCount: songCount,
        thumbnails: thumbnails
      });
    }

    return folders;
  } catch (error) {
    console.error(`Error reading directory ${folderPath}:`, error);
    return [];
  }
}

/**
 * NEW: Read full details of a specific folder when user clicks on it
 * This is where we load all the song metadata
 */

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
    const songCount = mp3Files.length

    const thumbnails = songCount > 0
      ? await getSampleThumbnails(mp3Files, folderPath)
      : [];


    return { playlistName: path.basename(folderPath), songs, path: folderPath, thumbnails: thumbnails };
  } catch (error) {
    console.error(`Error reading folder details ${folderPath}:`, error);
    return { songs: [], path: folderPath, error: error.message };
  }
}



/**
 * Extract full metadata from MP3 file
 */
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

/**
 * Read contents of a folder (legacy, kept for compatibility)
 */
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

/**
 * Create a new folder
 */
async function createFolder(event, { parentPath, folderName }) {
  const newFolderPath = path.join(parentPath, folderName);
  try {
    await fs.mkdir(newFolderPath, { recursive: false });
    return {
      success: true,
      path: newFolderPath,
      message: 'Folder created successfully'
    };
  } catch (error) {
    if (error.code === 'EEXIST') {
      return {
        success: false,
        error: 'Folder already exists'
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}
async function deleteFile(event, filePath) {
  try {
    const folderPath = path.dirname(filePath);
    await fs.unlink(filePath);

    // Generate updated folder data
    const updatedFolder = await generateLightFolderData(folderPath);

    event.sender.send("download-complete", {
      folderPath: folderPath,
      updatedFolder: updatedFolder
    });

    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function deleteFolder(event, folderPath) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });

    // For folder deletion, we send null as updatedFolder since the folder is gone
    event.sender.send("download-complete", {
      folderPath: folderPath,
      updatedFolder: null,
      deleted: true
    });

    return {
      success: true,
      message: 'Folder deleted successfully'
    };
  } catch (error) {
    console.error(`Error deleting folder ${folderPath}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format duration from seconds to HH:MM:SS or MM:SS
 */
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
  registerFileSystemHandlers
};
