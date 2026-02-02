const { exec } = require('child_process');
const path = require('path');

/**
 * Pushes changes to the remote repository.
 * Runs in background, logs errors if any.
 */
const syncToRemote = () => {
    const projectRoot = path.join(__dirname, '../../');
    
    // Command: 
    // 1. Add changes
    // 2. Commit (ignore error if nothing to commit)
    // 3. Push to remote
    const cmd = 'git add . && (git commit -m "Auto-update memory" || true) && git push origin main';

    exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Git Sync Error]: ${error.message}`);
            return;
        }
        if (stderr && !stderr.includes('Everything up-to-date') && !stderr.includes('nothing to commit')) {
             console.log(`[Git Sync Log]: ${stderr}`);
        }
    });
};

module.exports = { syncToRemote };
