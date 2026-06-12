import fs from 'fs';
import path from 'path';

const SRC_DIST = path.join(process.cwd(), 'dist');
const TARGET_ASSETS = path.join(process.cwd(), '.build_outputs', 'android_project', 'app', 'src', 'main', 'assets', 'www');

// Ensure output directories exist recursively
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Copy directory contents recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function compileAndPackage() {
  console.log('[COMPILER ENGINE] Initiating local packaging workflow...');
  
  if (!fs.existsSync(SRC_DIST)) {
    console.error('[ERROR] /dist folder not found. Plan: run npm run build first.');
    process.exit(1);
  }

  // Create target assets directory
  fs.mkdirSync(TARGET_ASSETS, { recursive: true });

  // Copy dist structure to android assets
  console.log(`[COMPILER ENGINE] Copying web build assets: ${SRC_DIST} -> ${TARGET_ASSETS}`);
  copyDir(SRC_DIST, TARGET_ASSETS);

  // Also copy sw.js and app_icon.jpg to root of assets
  const filesToCopy = ['sw.js', 'app_icon.jpg', 'manifest.json'];
  for (const file of filesToCopy) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`[COMPILER ENGINE] Copying local standalone helper: ${file}`);
      fs.copyFileSync(filePath, path.join(TARGET_ASSETS, file));
    }
  }

  // Patch index.html inside assets/www to use relative paths for complete offline capability
  const indexHtmlPath = path.join(TARGET_ASSETS, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    console.log('[COMPILER ENGINE] Optimizing index.html resource mapping for offline WebView rendering...');
    let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // Replace absolute link and script paths with relative paths
    htmlContent = htmlContent.replaceAll('href="/assets/', 'href="./assets/');
    htmlContent = htmlContent.replaceAll('src="/assets/', 'src="./assets/');
    htmlContent = htmlContent.replaceAll('href="/sw.js', 'href="./sw.js');
    htmlContent = htmlContent.replaceAll('href="/manifest.json', 'href="./manifest.json');

    // Also remove index.css path typos if any
    htmlContent = htmlContent.replaceAll('href="/index.css"', 'href="./index.css"');
    htmlContent = htmlContent.replaceAll('src="/index.tsx"', 'src="./index.tsx"');

    fs.writeFileSync(indexHtmlPath, htmlContent, 'utf8');
    console.log('[COMPILER ENGINE] Optimization complete. Relative paths patched successfully.');
  }

  console.log('[COMPILER ENGINE] Mobile build structures successfully compiled to /.build_outputs/android_project/app/src/main/assets/www');
}

compileAndPackage().catch(err => {
  console.error('[FATAL ERROR] Compilation failed:', err);
  process.exit(1);
});
