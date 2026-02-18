const { ipcMain } = require("electron");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");

const execAsync = promisify(exec);

/**
 */
function registerSyncHandlers() {
  ipcMain.handle('sync-to-phone', syncToPhone);
  ipcMain.handle('check-adb-connection', checkAdbConnection);
}

/**
 */
async function checkAdbConnection() {
  try {
    try {
      await execAsync('adb version');
    } catch (error) {
      return {
        success: false,
        error: 'ADB not found. Please install Android Platform Tools.',
        needsAdb: true
      };
    }

    const { stdout } = await execAsync('adb devices');
    const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('List of devices'));

    if (lines.length === 0) {
      return {
        success: false,
        error: 'No device connected. Please connect your Pixel 8 Pro via USB and enable USB debugging.',
        needsDevice: true
      };
    }

    const deviceLine = lines[0];
    if (deviceLine.includes('unauthorized')) {
      return {
        success: false,
        error: 'Device not authorized. Please check your phone and allow USB debugging.',
        needsAuth: true
      };
    }

    if (!deviceLine.includes('device')) {
      return {
        success: false,
        error: 'Device in wrong state. Please reconnect your phone.',
        needsReconnect: true
      };
    }

    const deviceId = deviceLine.split('\t')[0];

    try {
      await execAsync(`adb -s ${deviceId} shell "ls /sdcard/Music"`);
      return {
        success: true,
        deviceId: deviceId,
        message: 'Device connected and ready to sync!'
      };
    } catch (error) {
      try {
        await execAsync(`adb -s ${deviceId} shell "mkdir -p /sdcard/Music"`);
        return {
          success: true,
          deviceId: deviceId,
          message: 'Device connected! Music folder created.'
        };
      } catch (createError) {
        return {
          success: false,
          error: 'Cannot access /sdcard/Music folder. Check permissions.',
          needsPermissions: true
        };
      }
    }
  } catch (error) {
    console.error('ADB connection check error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 */
async function cleanupPhoneMusic(event, deviceId, rootPath, results) {
  try {
    event.sender.send('sync-progress', {
      status: 'cleaning',
      message: 'Checking for old files to remove...'
    });

    const { stdout } = await execAsync(`adb -s ${deviceId} shell "ls -1 /sdcard/Music"`);
    const phoneFiles = stdout.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.includes('Permission denied'));

    const localFiles = await fs.readdir(rootPath);
    const musicFiles = localFiles.filter(file =>
      /\.(mp3|m4a|flac|wav|ogg)$/i.test(file)
    );

    const filesToDelete = phoneFiles.filter(phoneFile =>
      !musicFiles.includes(phoneFile)
    );

    for (const fileToDelete of filesToDelete) {
      try {
        event.sender.send('sync-progress', {
          status: 'deleting',
          file: fileToDelete,
          message: `Removing ${fileToDelete}...`
        });

        await execAsync(`adb -s ${deviceId} shell "rm -f '/sdcard/Music/${fileToDelete}'"`);
        results.deleted.push(fileToDelete);

        event.sender.send('sync-progress', {
          status: 'deleted',
          file: fileToDelete,
          message: `✗ ${fileToDelete} removed from phone`
        });
      } catch (error) {
        console.error(`Error deleting file ${fileToDelete}:`, error);
        results.errors.push({
          file: fileToDelete,
          error: `Failed to delete: ${error.message}`
        });
      }
    }

    if (filesToDelete.length === 0) {
      event.sender.send('sync-progress', {
        status: 'clean',
        message: 'No old files to remove'
      });
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
    event.sender.send('sync-progress', {
      status: 'warning',
      message: `Cleanup warning: ${error.message}`
    });
  }
}

/**
 */
async function syncToPhone(event, { rootPath }) {
  try {
    const connectionCheck = await checkAdbConnection();
    if (!connectionCheck.success) {
      return connectionCheck;
    }

    const deviceId = connectionCheck.deviceId;
    const syncDbPath = path.join(rootPath, 'syncdb.txt');
    let syncDb = {};

    try {
      const syncDbContent = await fs.readFile(syncDbPath, 'utf8');
      syncDb = JSON.parse(syncDbContent);
    } catch (error) {
      syncDb = {
        lastSync: null,
        files: {}
      };
    }

    const results = {
      success: true,
      synced: [],
      skipped: [],
      deleted: [],
      errors: []
    };

    await cleanupPhoneMusic(event, deviceId, rootPath, results);

    const files = await fs.readdir(rootPath);
    const musicFiles = files.filter(file =>
      /\.(mp3|m4a|flac|wav|ogg)$/i.test(file)
    );

    for (const fileName of musicFiles) {
      try {
        const filePath = path.join(rootPath, fileName);
        const phoneDestination = `/sdcard/Music/${fileName}`;

        event.sender.send('sync-progress', {
          status: 'syncing',
          file: fileName,
          message: `Syncing ${fileName}...`
        });

        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        const fileModified = stats.mtime.toISOString();

        const needsSync = !syncDb.files[fileName] ||
          syncDb.files[fileName].size !== fileSize ||
          syncDb.files[fileName].modified !== fileModified;

        if (!needsSync && syncDb.files[fileName]) {
          results.skipped.push(fileName);
          event.sender.send('sync-progress', {
            status: 'skipped',
            file: fileName,
            message: `${fileName} already up to date`
          });
          continue;
        }

        await execAsync(
          `adb -s ${deviceId} push "${filePath}" "${phoneDestination}"`,
          { maxBuffer: 1024 * 1024 * 100 }
        );

        syncDb.files[fileName] = {
          size: fileSize,
          modified: fileModified,
          lastSynced: new Date().toISOString()
        };

        results.synced.push(fileName);
        event.sender.send('sync-progress', {
          status: 'complete',
          file: fileName,
          message: `✓ ${fileName} synced`
        });
      } catch (error) {
        console.error(`Error syncing file ${fileName}:`, error);
        results.errors.push({
          file: fileName,
          error: error.message
        });
        event.sender.send('sync-progress', {
          status: 'error',
          file: fileName,
          message: `Error: ${error.message}`
        });
      }
    }

    syncDb.lastSync = new Date().toISOString();
    await fs.writeFile(syncDbPath, JSON.stringify(syncDb, null, 2));

    return {
      success: results.errors.length === 0,
      synced: results.synced,
      skipped: results.skipped,
      deleted: results.deleted,
      errors: results.errors,
      message: `Sync complete: ${results.synced.length} synced, ${results.skipped.length} skipped, ${results.deleted.length} deleted, ${results.errors.length} errors`
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  registerSyncHandlers
};
