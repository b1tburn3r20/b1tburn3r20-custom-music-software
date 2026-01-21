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
async function cleanupPhoneFolders(event, deviceId, folders, results) {
  try {
    event.sender.send('sync-progress', {
      status: 'cleaning',
      message: 'Checking for old folders to remove...'
    });

    const { stdout } = await execAsync(`adb -s ${deviceId} shell "ls -1 /sdcard/Music"`);

    const phoneFolders = stdout.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.includes('Permission denied'));

    const syncFolderNames = folders.map(f => path.basename(f.path));

    const foldersToDelete = phoneFolders.filter(phoneFolder =>
      !syncFolderNames.includes(phoneFolder)
    );

    for (const folderToDelete of foldersToDelete) {
      try {
        event.sender.send('sync-progress', {
          status: 'deleting',
          folder: folderToDelete,
          message: `Removing ${folderToDelete}...`
        });

        await execAsync(`adb -s ${deviceId} shell "rm -rf '/sdcard/Music/${folderToDelete}'"`);

        results.deleted.push(folderToDelete);

        event.sender.send('sync-progress', {
          status: 'deleted',
          folder: folderToDelete,
          message: `✗ ${folderToDelete} removed from phone`
        });
      } catch (error) {
        console.error(`Error deleting folder ${folderToDelete}:`, error);
        results.errors.push({
          folder: folderToDelete,
          error: `Failed to delete: ${error.message}`
        });
      }
    }

    if (foldersToDelete.length === 0) {
      event.sender.send('sync-progress', {
        status: 'clean',
        message: 'No old folders to remove'
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
async function syncToPhone(event, { rootPath, folders }) {
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
        folders: {}
      };
    }

    const results = {
      success: true,
      synced: [],
      skipped: [],
      deleted: [],
      errors: []
    };

    await cleanupPhoneFolders(event, deviceId, folders, results);

    for (const folder of folders) {
      try {
        const folderName = path.basename(folder.path);
        const phoneDestination = `/sdcard/Music/${folderName}`;

        event.sender.send('sync-progress', {
          status: 'syncing',
          folder: folderName,
          message: `Syncing ${folderName}...`
        });

        const needsSync = !syncDb.folders[folderName] ||
          syncDb.folders[folderName].songCount !== folder.songCount;

        if (!needsSync && syncDb.folders[folderName]) {
          results.skipped.push(folderName);
          event.sender.send('sync-progress', {
            status: 'skipped',
            folder: folderName,
            message: `${folderName} already up to date`
          });
          continue;
        }

        await execAsync(`adb -s ${deviceId} shell "mkdir -p '${phoneDestination}'"`);

        const { stdout, stderr } = await execAsync(
          `adb -s ${deviceId} push "${folder.path}" "/sdcard/Music/"`,
          { maxBuffer: 1024 * 1024 * 100 }
        );

        syncDb.folders[folderName] = {
          path: folder.path,
          songCount: folder.songCount,
          lastSynced: new Date().toISOString()
        };

        results.synced.push(folderName);

        event.sender.send('sync-progress', {
          status: 'complete',
          folder: folderName,
          message: `✓ ${folderName} synced (${folder.songCount} songs)`
        });
      } catch (error) {
        console.error(`Error syncing folder ${folder.path}:`, error);
        results.errors.push({
          folder: path.basename(folder.path),
          error: error.message
        });
        event.sender.send('sync-progress', {
          status: 'error',
          folder: path.basename(folder.path),
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
