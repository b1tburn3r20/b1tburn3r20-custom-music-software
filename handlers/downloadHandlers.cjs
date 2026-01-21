const { ipcMain } = require("electron");
const { spawn } = require('child_process')
const path = require("path");
const mm = require('music-metadata');
const fs = require("fs").promises;
const { decode } = require('html-entities');

const { addSongToCache } = require('./fileSystemHandlers.cjs');

/**
 * @typedef {Object} MP3Metadata
 * @property {number} duration - Duration in seconds
 * @property {string} durationFormatted - Formatted duration (MM:SS or HH:MM:SS)
 * @property {string} thumbnail - URL to video thumbnail
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

function registerDownloadHandlers() {
  ipcMain.handle('download-youtube', downloadYouTube);
}

async function generateLightFolderData(folderPath) {
  const mp3Files = await getMp3Files(folderPath);
  const songCount = mp3Files.length;
  const thumbnails = songCount > 0 ? await getSampleThumbnails(mp3Files, folderPath) : [];

  const songs = []
  for (const fileName of mp3Files) {
    const filePath = path.join(folderPath, fileName)
    const thumbnail = await extractThumbnailOnly(filePath)
    songs.push({
      name: fileName,
      path: filePath,
      thumbnail,
    })
  }

  return {
    name: path.basename(folderPath),
    path: folderPath,
    songCount,
    thumbnails,
    songs,
  };
}


/**
 * @param {Event} event 
 * @param {Object} params 
 * @param {string} params.videoId 
 * @param {string} params.title -
 * @param {string} params.savePath 
 * @returns {Promise<DownloadedMP3>}
 */

async function downloadYouTube(event, { videoId, title, savePath }) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const decodedTitle = decode(title);
    const sanitizedTitle = decodedTitle.replace(/[<>:"/\\|?*]/g, '').trim();

    const metadataProcess = spawn('yt-dlp', [
      '-j',
      '--skip-download',
      '--no-warnings',
      url
    ]);

    let jsonBuffer = '';
    let stderrBuffer = '';

    metadataProcess.stdout.on('data', (data) => {
      jsonBuffer += data.toString();
    });

    metadataProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    metadataProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp metadata error:', stderrBuffer);
        reject({ success: false, error: 'Failed to fetch metadata' });
        return;
      }

      try {
        const parsed = JSON.parse(jsonBuffer);

        const metadata = {
          duration: parsed.duration || 0,
          durationFormatted: formatDuration(parsed.duration || 0),
          thumbnail: parsed.thumbnail || '',
          uploader: parsed.uploader || parsed.channel || 'Unknown',
          uploadDate: parsed.upload_date || '',
          uploadDateFormatted: formatUploadDate(parsed.upload_date),
          viewCount: parsed.view_count || 0,
          title: parsed.title || title,
          description: parsed.description || '',
          channel: parsed.channel || parsed.uploader || 'Unknown',
          channelId: parsed.channel_id || '',
          likeCount: parsed.like_count || 0
        };
        console.log("Heres the metadata", metadata)
        const outputTemplate = path.join(savePath, `${sanitizedTitle}.%(ext)s`);

        const downloadProcess = spawn('yt-dlp', [
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '0',
          '--embed-thumbnail',
          '--add-metadata',
          '--parse-metadata', 'uploader:%(artist)s',
          '--parse-metadata', 'channel:%(artist)s',
          '--parse-metadata', 'upload_date:%(date)s',
          '--newline',
          '--no-warnings',
          '-o', outputTemplate,
          url
        ]);

        let actualFilePath = null;

        downloadProcess.stdout.on('data', (data) => {
          const output = data.toString();
          const lines = output.split('\n');

          for (const line of lines) {
            if (line.trim().endsWith('.mp3')) {
              actualFilePath = line.trim();
            }
          }

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
          if (downloadCode === 0) {
            const finalPath = actualFilePath || outputTemplate.replace('%(ext)s', 'mp3');

            try {
              // Add the downloaded song to cache
              console.log('Adding downloaded song to cache:', finalPath);
              await addSongToCache(finalPath, savePath);

              // Generate updated folder data
              const updatedFolder = await generateLightFolderData(savePath);
              event.sender.send('download-complete', {
                folderPath: savePath,
                updatedFolder: updatedFolder
              });
            } catch (error) {
              console.error('Error updating cache or generating folder data:', error);
              event.sender.send('download-complete', {
                folderPath: savePath,
                updatedFolder: null
              });
            }

            resolve({
              success: true,
              path: finalPath,
              fileName: path.basename(finalPath),
              metadata: metadata
            });
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
      reject({ success: false, error: err.message });
    });
  });
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
 * @param {string} dateString -
 * @returns {string} 
 */
function formatUploadDate(dateString) {
  if (!dateString || dateString.length !== 8) return '';

  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);

  return `${year}-${month}-${day}`;
}

module.exports = {
  registerDownloadHandlers
};
