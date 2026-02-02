const { exec } = require('child_process');
const path = require('path');

let syncTimeout = null;
let isSyncing = false;
let pendingSync = false;
const DEBOUNCE_MS = 10000; // Wait for 10 seconds of inactivity

/**
 * Pushes changes to the remote repository.
 * Uses debouncing to prevent spamming git commands.
 */
const runGitSync = () => {
    if (isSyncing) {
        pendingSync = true; // Mark that we need another sync after this one
        return;
    }

    isSyncing = true;
    pendingSync = false;
    
    const projectRoot = path.join(__dirname, '../../');
    const cmd = 'git add . && (git commit -m "Auto-update memory" || true) && git push origin main';

    console.log("[Git Sync] Starting sync...");

    exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
        isSyncing = false;

        if (error) {
            console.error(`[Git Sync Error]: ${error.message}`);
        } else if (stderr && !stderr.includes('Everything up-to-date') && !stderr.includes('nothing to commit')) {
             console.log(`[Git Sync Log]: ${stderr}`);
        } else {
             console.log("[Git Sync] Completed successfully.");
        }

        // If a request came in while we were syncing, run again
        if (pendingSync) {
            syncToRemote(); // Schedule next run
        }
    });
};

const syncToRemote = () => {
    // Clear existing timer (debounce)
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    // Set new timer
    syncTimeout = setTimeout(() => {
        runGitSync();
    }, DEBOUNCE_MS);
};

module.exports = { syncToRemote };
