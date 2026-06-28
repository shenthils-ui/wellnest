// Generates PNG app icons with zero dependencies and zero network calls.
// Draws a soft sage rounded square with a cream heart, encoded as PNG using
// Node's built-in zlib. Run with: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

/* ---- PNG encoder (RGBA, 8-bit) ---- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rows prefixed with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---- drawing ---- */
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
const TOP = [0x69, 0xa4, 0x87]; // brand-400
const BOT = [0x3c, 0x6f, 0x59]; // brand-600
const CREAM = [0xfa, 0xf7, 0xf2];

// inside rounded rect?
function inRoundRect(x, y, S, r) {
  const min = r, maxX = S - r, maxY = S - r;
  let cx = x, cy = y;
  if (x < min) cx = min; else if (x > maxX) cx = maxX;
  if (y < min) cy = min; else if (y > maxY) cy = maxY;
  // for the straight edges this is true; only check corners
  if (x >= min && x <= maxX) return y >= 0 && y <= S;
  if (y >= min && y <= maxY) return x >= 0 && x <= S;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// inside heart? (implicit curve, y up)
function inHeart(px, py, S, scale, cy) {
  const cx = S / 2;
  const x = (px - cx) / scale;
  const y = (cy - py) / scale;
  const f = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
  return f <= 0;
}

function render(S, { rounded = true, heartScale = 0.31 } = {}) {
  const rgba = Buffer.alloc(S * S * 4);
  const r = S * 0.22;
  const scale = S * heartScale;
  const heartCy = S * 0.45;
  const SS = 3; // supersample
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let bgCov = 0, heartCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          const bg = rounded ? inRoundRect(fx, fy, S, r) : true;
          if (bg) bgCov++;
          if (bg && inHeart(fx, fy, S, scale, heartCy)) heartCov++;
        }
      }
      const n = SS * SS;
      const bgA = bgCov / n;
      const hA = heartCov / n;
      const grad = mix(TOP, BOT, y / S);
      const col = mix(grad, CREAM, hA); // blend heart over gradient
      const i = (y * S + x) * 4;
      rgba[i] = col[0];
      rgba[i + 1] = col[1];
      rgba[i + 2] = col[2];
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return encodePNG(S, S, rgba);
}

const jobs = [
  ['icon-192.png', render(192)],
  ['icon-512.png', render(512)],
  ['icon-maskable-512.png', render(512, { heartScale: 0.26 })], // smaller in safe zone
  ['apple-touch-icon-180.png', render(180, { rounded: false })],
  ['favicon-32.png', render(32, { heartScale: 0.33 })],
];
for (const [name, buf] of jobs) {
  writeFileSync(join(OUT, name), buf);
  console.log(`  wrote icons/${name} (${buf.length} bytes)`);
}
console.log('Icons generated.');
