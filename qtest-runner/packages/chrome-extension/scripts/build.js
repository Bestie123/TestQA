// Build script for chrome-extension
// Copies static files to dist/ after tsc compilation

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');
const dist = path.join(__dirname, '..', 'dist');
const icons = path.join(__dirname, '..', 'icons');

const files = ['manifest.json', 'popup.html', 'indicator.css'];

if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  const srcPath = path.join(src, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(dist, file));
  }
}

if (fs.existsSync(icons)) {
  const iconDist = path.join(dist, 'icons');
  if (!fs.existsSync(iconDist)) fs.mkdirSync(iconDist, { recursive: true });
  const iconFiles = fs.readdirSync(icons);
  for (const icon of iconFiles) {
    const iconPath = path.join(icons, icon);
    if (fs.statSync(iconPath).isFile()) {
      fs.copyFileSync(iconPath, path.join(iconDist, icon));
    }
  }
}

console.log('Extension static files copied to dist/');
