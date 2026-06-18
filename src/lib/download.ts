import type { Slideshow } from '../types';
import { renderSlideshow } from './render';

interface ZipFile {
  path: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();

function sanitizeName(value: string, fallback: string) {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return clean || fallback;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textBytes(text: string) {
  return encoder.encode(text);
}

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

function crc32(data: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function makeZip(files: ZipFile[]) {
  const parts: BlobPart[] = [];
  const central: number[] = [];
  const { time, day } = dosDateTime();
  let offset = 0;

  for (const file of files) {
    const name = textBytes(file.path);
    const crc = crc32(file.data);
    const localOffset = offset;
    const local: number[] = [];

    writeU32(local, 0x04034b50);
    writeU16(local, 20);
    writeU16(local, 0x0800);
    writeU16(local, 0);
    writeU16(local, time);
    writeU16(local, day);
    writeU32(local, crc);
    writeU32(local, file.data.length);
    writeU32(local, file.data.length);
    writeU16(local, name.length);
    writeU16(local, 0);
    parts.push(new Uint8Array(local) as BlobPart, name as BlobPart, file.data as BlobPart);
    offset += local.length + name.length + file.data.length;

    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0x0800);
    writeU16(central, 0);
    writeU16(central, time);
    writeU16(central, day);
    writeU32(central, crc);
    writeU32(central, file.data.length);
    writeU32(central, file.data.length);
    writeU16(central, name.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, localOffset);
    central.push(...name);
  }

  const centralOffset = offset;
  const eocd: number[] = [];

  writeU32(eocd, 0x06054b50);
  writeU16(eocd, 0);
  writeU16(eocd, 0);
  writeU16(eocd, files.length);
  writeU16(eocd, files.length);
  writeU32(eocd, central.length);
  writeU32(eocd, centralOffset);
  writeU16(eocd, 0);

  return new Blob([...parts, new Uint8Array(central) as BlobPart, new Uint8Array(eocd) as BlobPart], { type: 'application/zip' });
}

function clickDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function captionText(show: Slideshow) {
  const tags = show.hashtags.length ? `\n\n${show.hashtags.map((tag) => `#${tag}`).join(' ')}` : '';
  return `${show.caption}${tags}`;
}

async function slideshowFiles(show: Slideshow, folder: string): Promise<ZipFile[]> {
  const rendered = await renderSlideshow(show);
  const files: ZipFile[] = rendered.map((dataUrl, index) => ({
    path: `${folder}/slide-${String(index + 1).padStart(2, '0')}.png`,
    data: dataUrlToBytes(dataUrl),
  }));

  files.push(
    { path: `${folder}/caption.txt`, data: textBytes(captionText(show)) },
    { path: `${folder}/hashtags.txt`, data: textBytes(show.hashtags.map((tag) => `#${tag}`).join(' ')) },
    {
      path: `${folder}/metadata.json`,
      data: textBytes(JSON.stringify({
        id: show.id,
        hook: show.hook,
        caption: show.caption,
        hashtags: show.hashtags,
        rationale: show.rationale,
        createdAt: show.createdAt,
        slideCount: show.slides.length,
      }, null, 2)),
    }
  );

  return files;
}

export async function downloadSlideshows(slideshows: Slideshow[]) {
  if (!slideshows.length) return;
  const files: ZipFile[] = [];
  for (let i = 0; i < slideshows.length; i++) {
    const show = slideshows[i];
    const folder = `${String(i + 1).padStart(2, '0')}-${sanitizeName(show.hook, show.id)}`;
    files.push(...await slideshowFiles(show, folder));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = slideshows.length === 1
    ? `${sanitizeName(slideshows[0].hook, slideshows[0].id)}.zip`
    : `slidesmith-posts-${stamp}-${slideshows.length}.zip`;
  clickDownload(makeZip(files), filename);
}
