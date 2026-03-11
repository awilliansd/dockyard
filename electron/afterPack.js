const { execSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

/**
 * After electron-builder creates the unpacked directory,
 * install server production dependencies using npm (flat node_modules).
 * pnpm's symlink-based node_modules doesn't survive asar packaging.
 */
exports.default = async function (context) {
  // The unpacked app directory inside the build output
  const appDir = path.join(context.appOutDir, 'resources', 'app');

  if (!existsSync(appDir)) {
    console.log('[afterPack] No app dir found (asar?), trying asar unpack...');
    // If asar is enabled, we need to work with the unpacked directory
    const asarFile = path.join(context.appOutDir, 'resources', 'app.asar');
    if (existsSync(asarFile)) {
      // Install deps alongside the asar
      const depsDir = path.join(context.appOutDir, 'resources', 'app.asar.unpacked');
      mkdirSync(depsDir, { recursive: true });
      installDeps(depsDir);
    }
    return;
  }

  installDeps(appDir);
};

function installDeps(targetDir) {
  console.log('[afterPack] Installing production dependencies in:', targetDir);

  const serverPkgPath = path.resolve(__dirname, '..', 'server', 'package.json');
  const serverPkg = JSON.parse(readFileSync(serverPkgPath, 'utf-8'));

  // Create package.json with server production dependencies
  const prodPkg = {
    name: 'shipyard-runtime',
    version: '1.0.0',
    dependencies: serverPkg.dependencies || {},
    optionalDependencies: serverPkg.optionalDependencies || {},
  };

  const pkgPath = path.join(targetDir, 'package.json');
  writeFileSync(pkgPath, JSON.stringify(prodPkg, null, 2));

  try {
    execSync('npm install --production --ignore-scripts', {
      cwd: targetDir,
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('[afterPack] Dependencies installed successfully');
  } catch (err) {
    console.error('[afterPack] npm install failed:', err.message);
    // Try without optional (node-pty might fail)
    try {
      execSync('npm install --production --no-optional --ignore-scripts', {
        cwd: targetDir,
        stdio: 'inherit',
        timeout: 120000,
      });
      console.log('[afterPack] Dependencies installed (without optional)');
    } catch (err2) {
      console.error('[afterPack] CRITICAL: Could not install dependencies');
      throw err2;
    }
  }
}
