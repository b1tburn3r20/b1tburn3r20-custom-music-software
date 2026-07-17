const { ipcMain, app } = require("electron");
const { spawn } = require('child_process')
const path = require("path");
const mm = require('music-metadata');
const fs = require("fs").promises;
const { decode } = require('html-entities');
const crypto = require('crypto');

const { addSongToCache } = require('./fileSystemHandlers.cjs');

let activeDownloadProcesses = new Set();

/**
 * @typedef {Object} MP3Metadata
 * @property {number} duration - Duration in seconds
 * @property {string} durationFormatted - Formatted duration (MM:SS or HH:MM:SS)
 * @property {string|null} thumbnail - File URL to cached thumbnail
 * @property {string} uploader - Channel/uploader name
 * @property {string} uploadDate - Upload date in YYYYMMDD format
 * @property {string} uploadDateFormatted - Upload date in YYYY-MM-DD format
 * @property {number} viewCount - Number of views
 * @property {string} title - Video title
 * @property {string} description - Video description
 * @property {string} channel - Channel name
 * @property {string} channelId - Channel ID
 * @property {number} likeCount - Number of likes
 */

/**
 * @typedef {Object} DownloadedMP3
 * @property {boolean} success
 * @property {string} path 
 * @property {string} fileName 
 * @property {MP3Metadata} metadata 
 */

function getThumbnailCacheDir() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'thumbnails');
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
      console.error("FAILED TO EXTRACT CACHE", err)
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

function registerDownloadHandlers() {
  ipcMain.handle('download-youtube', downloadYouTube);
  ipcMain.handle('cancel-download', cancelAllDownloads);
}

function cancelAllDownloads() {
  activeDownloadProcesses.forEach(process => {
    try {
      process.kill('SIGTERM');
    } catch (err) {
      console.error('Error killing process:', err);
    }
  });
  activeDownloadProcesses.clear();
  return { success: true, cancelled: true };
}

/**
 * @param {Event} event 
 * @param {Object} params 
 * @param {string} params.videoId 
 * @param {string} params.title 
 * @param {string} params.savePath
 * @returns {Promise<DownloadedMP3>}
 */

async function downloadYouTube(event, { videoId, title, savePath }) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const decodedTitle = decode(title);
    const sanitizedTitle = decodedTitle.replace(/[<>:"/\\|?*]/g, '').trim();

    const commonArgs = [
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--extractor-args', 'youtube:player_client=android',
      '--geo-bypass',
      '--force-ipv4',
      '--no-warnings'
    ];

    const metadataProcess = spawn('yt-dlp', [
      ...commonArgs,
      '-j',
      '--skip-download',
      url
    ]);

    activeDownloadProcesses.add(metadataProcess);

    let jsonBuffer = '';
    let stderrBuffer = '';

    metadataProcess.stdout.on('data', (data) => {
      jsonBuffer += data.toString();
    });

    metadataProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    metadataProcess.on('close', (code) => {
      activeDownloadProcesses.delete(metadataProcess);

      if (code !== 0) {
        console.error('yt-dlp metadata error:', stderrBuffer);
        reject({ success: false, error: 'Failed to fetch metadata' });
        return;
      }

      try {

        const outputTemplate = path.join(savePath, `${sanitizedTitle}.%(ext)s`);
        const finalFilePath = outputTemplate.replace('%(ext)s', 'mp3');

        const downloadProcess = spawn('yt-dlp', [
          ...commonArgs,
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '0',
          '--embed-thumbnail',
          '--add-metadata',
          '--newline',
          '-o', outputTemplate,
          url
        ]);

        activeDownloadProcesses.add(downloadProcess);

        downloadProcess.stdout.on('data', (data) => {
          const output = data.toString();
          const progressMatch = output.match(/(\d+\.?\d*)%/);
          if (progressMatch) {
            event.sender.send('download-progress', {
              videoId,
              percent: parseFloat(progressMatch[1]).toFixed(2),
              downloaded: 0,
              total: 0
            });
          }
        });

        downloadProcess.stderr.on('data', (data) => {
          console.error('yt-dlp stderr:', data.toString());
        });

        downloadProcess.on('close', async (downloadCode) => {
          activeDownloadProcesses.delete(downloadProcess);

          if (downloadCode === 0) {
            try {
              await fs.access(finalFilePath);

              await addSongToCache(finalFilePath, savePath);

              const newSongData = await getSongData(finalFilePath);

              event.sender.send('download-complete', {
                rootDir: savePath,
                newSong: newSongData,
                success: true
              });

              resolve({
                path: finalFilePath,
                name: path.basename(finalFilePath),
                metadata: newSongData.metadata
              });
            } catch (err) {
              console.error('File does not exist yet:', finalFilePath, err);
              event.sender.send('download-complete', {
                rootDir: savePath,
                newSong: null,
                success: false,
                error: 'Downloaded file does not exist'
              });
              reject({ success: false, error: 'File not found after download' });
            }
          } else if (downloadCode === null) {
            reject({ success: false, error: 'Download cancelled', cancelled: true });
          } else {
            reject({ success: false, error: `Download failed with code ${downloadCode}` });
          }
        });
      } catch (err) {
        console.error('Failed to parse metadata JSON:', err);
        reject({ success: false, error: 'Failed to parse metadata: ' + err.message });
      }
    });

    metadataProcess.on('error', (err) => {
      activeDownloadProcesses.delete(metadataProcess);
      reject({ success: false, error: err.message });
    });
  });
}
async function getSongData(filePath) {
  try {
    const metadata = await extractMp3Metadata(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      metadata: metadata
    };
  } catch (error) {
    console.error('Error getting song data:', error);
    return null;
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

/**
 * @param {number} seconds 
 * @returns {string}
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

/**
 * @param {string} dateString 
 * @returns {string} 
 */


module.exports = {
  registerDownloadHandlers
};
