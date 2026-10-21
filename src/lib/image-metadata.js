const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function jpegWithDpi(bytes, dpi) {
  const density = Math.max(1, Math.min(65535, Math.round(dpi)));
  const out = new Uint8Array(bytes);
  if (out[0] !== 0xff || out[1] !== 0xd8) return out;
  let offset = 2;
  while (offset + 4 < out.length) {
    if (out[offset] !== 0xff) break;
    const marker = out[offset + 1];
    if (marker === 0xda) break;
    const length = (out[offset + 2] << 8) | out[offset + 3];
    if (length < 2) break;
    if (
      marker === 0xe0 &&
      out[offset + 4] === 0x4a &&
      out[offset + 5] === 0x46 &&
      out[offset + 6] === 0x49 &&
      out[offset + 7] === 0x46
    ) {
      out[offset + 11] = 1;
      out[offset + 12] = (density >> 8) & 0xff;
      out[offset + 13] = density & 0xff;
      out[offset + 14] = (density >> 8) & 0xff;
      out[offset + 15] = density & 0xff;
      return out;
    }
    offset += 2 + length;
  }
  const segment = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x01,
    (density >> 8) & 0xff, density & 0xff,
    (density >> 8) & 0xff, density & 0xff,
    0x00, 0x00
  ]);
  const result = new Uint8Array(out.length + segment.length);
  result.set(out.subarray(0, 2), 0);
  result.set(segment, 2);
  result.set(out.subarray(2), 2 + segment.length);
  return result;
}

function pngWithDpi(bytes, dpi) {
  if (bytes.length < 33) return bytes;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return bytes;
  const ppm = Math.max(1, Math.round(dpi / 0.0254));
  const data = new Uint8Array(9);
  data.set(u32(ppm), 0);
  data.set(u32(ppm), 4);
  data[8] = 1;
  const type = new TextEncoder().encode("pHYs");
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, type.length);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  chunk.set(u32(9), 0);
  chunk.set(type, 4);
  chunk.set(data, 8);
  chunk.set(u32(crc32(crcInput)), 17);
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  const result = new Uint8Array(bytes.length + chunk.length);
  result.set(bytes.subarray(0, ihdrEnd), 0);
  result.set(chunk, ihdrEnd);
  result.set(bytes.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return result;
}

export async function setImageDpi(blob, dpi) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const type = blob.type || "";
  let result;
  if (type === "image/jpeg" || (bytes[0] === 0xff && bytes[1] === 0xd8)) {
    result = jpegWithDpi(bytes, dpi);
  } else if (type === "image/png" || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
    result = pngWithDpi(bytes, dpi);
  } else {
    return blob;
  }
  return new Blob([result], { type: type || "application/octet-stream" });
}

export async function readImageMetadata(file) {
  try {
    const module = await import("exifr");
    const exifr = module.default || module;
    const data = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      ifd0: true,
      interop: false,
      translateValues: true,
      reviveValues: true
    });
    if (!data) return {};
    return data;
  } catch {
    return {};
  }
}
