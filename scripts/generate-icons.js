import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Ensure public directory exists
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const c = crc32(typeAndData);
  chunk.writeUInt32BE(c, 8 + len);
  return chunk;
}

function generateCricketPNG(width, height, isMaskable = false) {
  // Cricket Theme colors:
  // Background: Dark Navy #0B132B / #0A0F1D
  // Accent: Emerald Green #10B981, Golden Stumps #F59E0B, White ball/crease #F8FAFC
  const bgR = 10, bgG = 15, bgB = 29;
  const greenR = 16, greenG = 185, greenB = 129;
  const goldR = 245, goldG = 158, goldB = 11;
  const whiteR = 248, whiteG = 250, whiteB = 252;
  const redBallR = 239, redBallG = 68, redBallB = 68;

  const rawRowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rawRowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = (Math.min(width, height) / 2) * (isMaskable ? 0.95 : 0.88);
  const innerR = outerR * 0.92;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawRowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background
      let r = bgR, g = bgG, b = bgB, a = 255;

      // Outer stadium / ball ring
      if (dist < outerR) {
        // Gradient background inside badge
        const gradRatio = (y / height);
        r = Math.round(13 + gradRatio * 15);
        g = Math.round(21 + gradRatio * 35);
        b = Math.round(42 + gradRatio * 50);

        // Emerald outer border ring
        if (dist > innerR) {
          r = greenR; g = greenG; b = greenB;
        }

        // Cricket Wickets / Stumps in center
        // 3 stumps: x offsets: -0.15*cx, 0, +0.15*cx
        const stumpW = width * 0.035;
        const stumpTop = cy - height * 0.18;
        const stumpBottom = cy + height * 0.22;
        const bailTop = stumpTop - height * 0.03;

        // Check if inside any stump
        const s1 = Math.abs(x - (cx - width * 0.09)) <= stumpW / 2;
        const s2 = Math.abs(x - cx) <= stumpW / 2;
        const s3 = Math.abs(x - (cx + width * 0.09)) <= stumpW / 2;

        if ((s1 || s2 || s3) && y >= stumpTop && y <= stumpBottom) {
          r = goldR; g = goldG; b = goldB;
        }

        // Bails on top
        if (y >= bailTop && y <= stumpTop && Math.abs(x - cx) <= width * 0.14) {
          r = goldR; g = goldG; b = goldB;
        }

        // Crossed Bat angle or cricket ball
        // Cricket ball at bottom-right of stumps
        const ballCx = cx + width * 0.16;
        const ballCy = cy + height * 0.10;
        const ballR = width * 0.10;
        const ballDist = Math.sqrt((x - ballCx) ** 2 + (y - ballCy) ** 2);
        if (ballDist <= ballR) {
          r = redBallR; g = redBallG; b = redBallB;
          // Seam line
          const seamDist = Math.abs((x - ballCx) - (y - ballCy) * 0.4);
          if (seamDist < 2) {
            r = whiteR; g = whiteG; b = whiteB;
          }
        }

        // Pitch / grass ground arc
        if (y > stumpBottom && y < cy + height * 0.28 && Math.abs(dx) < outerR * 0.6) {
          r = greenR; g = greenG; b = greenB;
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT
  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  // PNG Header
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate assets
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generateCricketPNG(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generateCricketPNG(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generateCricketPNG(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generateCricketPNG(180, 180, false));

// SVG Brand icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0a0f1d"/>
    </radialGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="216" stroke="url(#emeraldGrad)" stroke-width="12" stroke-dasharray="8 6"/>
  
  <!-- Stumps -->
  <g fill="url(#goldGrad)">
    <!-- Bails -->
    <rect x="180" y="170" width="152" height="14" rx="6"/>
    <!-- 3 Stumps -->
    <rect x="194" y="184" width="18" height="170" rx="8"/>
    <rect x="247" y="184" width="18" height="170" rx="8"/>
    <rect x="300" y="184" width="18" height="170" rx="8"/>
  </g>
  <!-- Grass Pitch Base -->
  <path d="M140 354 Q256 374 372 354 L360 380 Q256 395 152 380 Z" fill="#10b981"/>
  
  <!-- Cricket Ball -->
  <g transform="translate(320, 270)">
    <circle cx="45" cy="45" r="45" fill="#ef4444"/>
    <path d="M12 25 Q45 45 78 65" stroke="#ffffff" stroke-width="4" stroke-dasharray="3 3"/>
  </g>
  
  <!-- Crossed Bat -->
  <g transform="rotate(-35 256 256)">
    <rect x="246" y="70" width="20" height="70" rx="8" fill="#e2e8f0"/>
    <path d="M242 140 L270 140 L266 310 L246 310 Z" fill="#b45309" stroke="#78350f" stroke-width="3"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), generateCricketPNG(64, 64, false));

console.log('Successfully generated PWA PNG and SVG assets!');
