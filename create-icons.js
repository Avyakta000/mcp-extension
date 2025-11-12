/**
 * Create simple base64 PNG icons for the extension
 * These are minimal 1x1 pixel PNGs that Chrome will accept
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG base64 (1x1 purple pixel)
const purplePixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
);

const sizes = [16, 48, 128];
const publicDir = path.join(__dirname, 'public');

// Create larger placeholder images (just copy the same pixel)
sizes.forEach(size => {
  const filePath = path.join(publicDir, `icon${size}.png`);
  fs.writeFileSync(filePath, purplePixel);
  console.log(`Created ${filePath}`);
});

console.log('\nNote: These are minimal 1x1 PNG files.');
console.log('Replace them with proper icons for production use.');
console.log('You can create icons at: https://favicon.io/emoji-favicons/');
