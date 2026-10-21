import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "public");
mkdirSync(outputDir, { recursive: true });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = crcTable[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy
      ? pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
      : raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function roundedRect(px, py, x0, y0, x1, y1, radius) {
  const cx = clamp(px, x0 + radius, x1 - radius);
  const cy = clamp(py, y0 + radius, y1 - radius);
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius;
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, yi] = points[index];
    const [xj, yj] = points[previous];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function capsule(px, py, x0, y0, x1, y1, width) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp(((px - x0) * dx + (py - y0) * dy) / lengthSq, 0, 1);
  const nx = x0 + dx * t;
  const ny = y0 + dy * t;
  return Math.hypot(px - nx, py - ny) <= width / 2;
}

function starPolygon(cx, cy, outer, inner, points = 4) {
  const vertices = [];
  for (let index = 0; index < points * 2; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const radius = index % 2 === 0 ? outer : inner;
    vertices.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return vertices;
}

function backgroundAt(x, y) {
  const t = clamp((x + y) / 2, 0, 1);
  let r = mix(124, 255, t);
  let g = mix(92, 92, t);
  let b = mix(255, 138, t);
  const glow = Math.exp(-(((x - 0.18) ** 2 + (y - 0.12) ** 2) / 0.09));
  const amount = glow * 0.16;
  r = mix(r, 255, amount);
  g = mix(g, 255, amount);
  b = mix(b, 255, amount);
  return [r, g, b, 255];
}

function renderIcon(size, scale) {
  const supersample = size <= 192 ? 4 : 2;
  const work = size * supersample;
  const data = Buffer.alloc(work * work * 4);

  const place = (x, y) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale];
  const page = [0.29, 0.19, 0.71, 0.81].map((value, index) => place(value, value)[0]);
  const [pageX0, pageY0, pageX1, pageY1] = page;
  const fold = [
    place(0.585, 0.19),
    place(0.71, 0.315),
    place(0.585, 0.315)
  ];
  const spark = starPolygon(...place(0.775, 0.185), 0.075 * scale, 0.019 * scale);
  const lineWidth = 0.036 * scale;
  const lineOne = [place(0.365, 0.5), place(0.635, 0.5)];
  const lineTwo = [place(0.365, 0.585), place(0.55, 0.585)];
  const lineThree = [place(0.365, 0.67), place(0.6, 0.67)];

  for (let y = 0; y < work; y += 1) {
    for (let x = 0; x < work; x += 1) {
      const nx = (x + 0.5) / work;
      const ny = (y + 0.5) / work;
      let color = backgroundAt(nx, ny);

      if (roundedRect(nx, ny, pageX0, pageY0, pageX1, pageY1, 0.027 * scale)) {
        color = [255, 255, 255, 255];
        if (pointInPolygon(nx, ny, fold)) color = [218, 208, 255, 255];
        if (
          capsule(nx, ny, lineOne[0][0], lineOne[0][1], lineOne[1][0], lineOne[1][1], lineWidth) ||
          capsule(nx, ny, lineTwo[0][0], lineTwo[0][1], lineTwo[1][0], lineTwo[1][1], lineWidth) ||
          capsule(nx, ny, lineThree[0][0], lineThree[0][1], lineThree[1][0], lineThree[1][1], lineWidth)
        ) {
          color = [124, 92, 255, 255];
        }
      }
      if (pointInPolygon(nx, ny, spark)) color = [255, 255, 255, 255];

      const offset = (y * work + x) * 4;
      data[offset] = Math.round(color[0]);
      data[offset + 1] = Math.round(color[1]);
      data[offset + 2] = Math.round(color[2]);
      data[offset + 3] = 255;
    }
  }

  const output = Buffer.alloc(size * size * 4);
  const samples = supersample * supersample;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const offset = ((y * supersample + sy) * work + (x * supersample + sx)) * 4;
          r += data[offset];
          g += data[offset + 1];
          b += data[offset + 2];
        }
      }
      const offset = (y * size + x) * 4;
      output[offset] = Math.round(r / samples);
      output[offset + 1] = Math.round(g / samples);
      output[offset + 2] = Math.round(b / samples);
      output[offset + 3] = 255;
    }
  }
  return encodePng(size, size, output);
}

const targets = [
  ["icon-180.png", 180, 0.84],
  ["icon-192.png", 192, 0.84],
  ["icon-512.png", 512, 0.84],
  ["icon-maskable-512.png", 512, 0.68]
];

for (const [name, size, scale] of targets) {
  const file = join(outputDir, name);
  writeFileSync(file, renderIcon(size, scale));
  console.log(`wrote public/${name} (${size}x${size})`);
}
