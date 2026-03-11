const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

/**
 * After electron-builder creates the unpacked directory,
 * install server production dependencies using npm (flat node_modules).
 * pnpm's symlink-based node_modules doesn't survive packaging.
 */
exports.default = async function (context) {
  const appDir = path.join(context.appOutDir, 'resources', 'app');

  if (!existsSync(appDir)) {
    console.log('[afterPack] No app dir found, skipping dependency install');
    return;
  }

  // Install deps inside server/ using its own package.json
  // (don't install at app root — that would overwrite the root package.json Electron needs)
  const serverDir = path.join(appDir, 'server');

  if (!existsSync(path.join(serverDir, 'package.json'))) {
    console.log('[afterPack] No server/package.json found, skipping');
    return;
  }

  console.log('[afterPack] Installing server production dependencies in:', serverDir);

  try {
    execSync('npm install --omit=dev --ignore-scripts', {
      cwd: serverDir,
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('[afterPack] Dependencies installed successfully');
  } catch (err) {
    console.error('[afterPack] npm install failed:', err.message);
    // Try without optional (node-pty might fail on some systems)
    try {
      execSync('npm install --omit=dev --no-optional --ignore-scripts', {
        cwd: serverDir,
        stdio: 'inherit',
        timeout: 120000,
      });
      console.log('[afterPack] Dependencies installed (without optional)');
    } catch (err2) {
      console.error('[afterPack] CRITICAL: Could not install dependencies');
      throw err2;
    }
  }
};
