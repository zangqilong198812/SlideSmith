// Client-side slide renderer. Each slide becomes a 1080×1920 PNG drawn on a
// canvas — text over a gradient. No image-generation API, no cost, deterministic
// output. The resulting data URLs are sent to the server, which uploads them to
// post-bridge as the post's media.
//
// Caption geometry (font %, stroke, line-height, padding, centering) comes from
// lib/captionStyle.ts — the SAME constants the editor preview uses — so the
// scheduled PNG matches what the user saw when editing.
import type { Slide, Slideshow } from '../types';
import { FONT_SIZE_PCT, STROKE_RATIO, LINE_HEIGHT, SIDE_PAD_PCT, pct } from './captionStyle';
import { SHOWCASE_MOCKUP } from './showcaseMockup';

const W = 1080;
const H = 1920;
// Word-wrap within hard newlines, mirroring the preview's wrapping.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { out.push(''); continue; }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

// Draw an image to cover the whole canvas (object-fit: cover).
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.min(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function drawCoverRect(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawNotesSlide(ctx: CanvasRenderingContext2D, text: string) {
  ctx.fillStyle = '#f8f5eb';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f2eddf';
  ctx.fillRect(0, 0, W, 164);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(0, 164, W, 2);

  const dotY = 82;
  [
    ['#ff5f57', 72],
    ['#ffbd2e', 112],
    ['#28c840', 152],
  ].forEach(([color, x]) => {
    ctx.fillStyle = String(color);
    ctx.beginPath();
    ctx.arc(Number(x), dotY, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.font = '700 48px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText('Notes', W / 2, 82);

  const [title, ...bodyParts] = text.split('\n');
  const body = bodyParts.join('\n').trim();
  const left = 76;
  const maxWidth = W - left * 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#191919';
  ctx.lineJoin = 'round';

  ctx.font = '800 82px Inter, sans-serif';
  const titleLines = wrap(ctx, title || 'note to self', maxWidth);
  let y = 268;
  for (const line of titleLines.slice(0, 4)) {
    ctx.fillText(line, left, y);
    y += 90;
  }

  y += 54;
  ctx.font = '600 56px Inter, sans-serif';
  const bodyLines = wrap(ctx, body, maxWidth);
  for (const line of bodyLines.slice(0, 18)) {
    if (!line) {
      y += 34;
      continue;
    }
    ctx.fillText(line, left, y);
    y += 78;
  }

  drawRoundedRect(ctx, 50, 238, W - 100, Math.min(1180, Math.max(520, y - 220)), 36);
  ctx.strokeStyle = 'rgba(0,0,0,0.045)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawFallbackPhoneScreen(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#20242b');
  grad.addColorStop(1, '#07080a');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const size = 86;
      const gap = 38;
      const bx = x + 68 + col * (size + gap);
      const by = y + 210 + row * (size + 58);
      drawRoundedRect(ctx, bx, by, size, size, 22);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  drawRoundedRect(ctx, x + 54, y + h - 170, w - 108, 104, 34);
  ctx.fill();
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  fillStyle = '#ffffff',
  shadow = true,
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = fillStyle;
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

async function drawShowcaseSlide(ctx: CanvasRenderingContext2D, slide: Slide) {
  let image: HTMLImageElement | null = null;
  let phoneFrame: HTMLImageElement | null = null;
  if (slide.imageUrl) {
    try {
      image = await loadImage(slide.imageUrl);
    } catch {
      image = null;
    }
  }
  try {
    phoneFrame = await loadImage(SHOWCASE_MOCKUP.frameSrc);
  } catch {
    phoneFrame = null;
  }

  if (image) {
    ctx.save();
    ctx.filter = 'blur(34px)';
    drawCover(ctx, image);
    ctx.restore();
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, slide.bgFrom || '#c8d2d4');
    grad.addColorStop(0.52, '#0d0f12');
    grad.addColorStop(1, slide.bgTo || '#b8ada0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.43)';
  ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(W / 2, H / 2, H / 4, W / 2, H / 2, H);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const [rawTitle, ...rawBody] = (slide.text || '').split('\n');
  const title = rawTitle?.trim() || 'Control Center';
  const subtitle = rawBody.join(' ').trim();

  ctx.font = '800 72px Inter, sans-serif';
  const titleLines = wrap(ctx, title, 840).slice(0, 2);
  drawCenteredLines(ctx, titleLines, W / 2, 210, 82);

  const phoneW = 620;
  const phoneH = phoneW * (SHOWCASE_MOCKUP.frame.height / SHOWCASE_MOCKUP.frame.width);
  const phoneX = (W - phoneW) / 2;
  const phoneY = 292;
  const scale = phoneW / SHOWCASE_MOCKUP.frame.width;
  const screenX = phoneX + SHOWCASE_MOCKUP.screen.x * scale;
  const screenY = phoneY + SHOWCASE_MOCKUP.screen.y * scale;
  const screenW = SHOWCASE_MOCKUP.screen.width * scale;
  const screenH = SHOWCASE_MOCKUP.screen.height * scale;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.48)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 30;
  if (phoneFrame) {
    ctx.drawImage(phoneFrame, phoneX, phoneY, phoneW, phoneH);
  } else {
    drawRoundedRect(ctx, phoneX, phoneY, phoneW, phoneH, 62);
    ctx.fillStyle = '#050607';
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, screenX, screenY, screenW, screenH, SHOWCASE_MOCKUP.screen.radius * scale);
  ctx.clip();
  if (image) {
    drawCoverRect(ctx, image, screenX, screenY, screenW, screenH);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(screenX, screenY, screenW, screenH);
  } else {
    drawFallbackPhoneScreen(ctx, screenX, screenY, screenW, screenH);
  }
  ctx.restore();

  if (phoneFrame) {
    ctx.drawImage(phoneFrame, phoneX, phoneY, phoneW, phoneH);
  }

  if (subtitle) {
    ctx.font = '700 44px Inter, sans-serif';
    const subtitleLines = wrap(ctx, subtitle, 830).slice(0, 3);
    drawCenteredLines(ctx, subtitleLines, W / 2, 1626, 58, '#ffffff', true);
  }
}

export async function renderSlide(slide: Slide): Promise<string> {
  // Make sure the web font is ready, otherwise the first render uses a fallback.
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  if (slide.layout === 'notes') {
    drawNotesSlide(ctx, slide.text || '');
    return canvas.toDataURL('image/png');
  }

  if (slide.layout === 'showcase') {
    await drawShowcaseSlide(ctx, slide);
    return canvas.toDataURL('image/png');
  }

  if (slide.imageUrl) {
    // Image background (same-origin: bundled at /library/… or scraped via /api/…).
    try {
      const img = await loadImage(slide.imageUrl);
      if (slide.imageFit === 'contain') {
        ctx.fillStyle = slide.bgFrom || '#ffffff';
        ctx.fillRect(0, 0, W, H);
        drawContain(ctx, img);
      } else {
        drawCover(ctx, img);
      }
      if (slide.darkOverlay !== false) {
        // Darken so white text stays readable.
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
      }
    } catch {
      ctx.fillStyle = slide.bgFrom || '#0f172a';
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, slide.bgFrom || '#0f172a');
    grad.addColorStop(1, slide.bgTo || '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Subtle vignette for depth
    const vig = ctx.createRadialGradient(W / 2, H / 2, H / 3, W / 2, H / 2, H);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // Caption: white bold text, black outline, centered — driven by the SAME
  // percentages the editor preview uses, so the two always match.
  const fontPx = Math.round(H * pct(FONT_SIZE_PCT));
  const lineHeight = Math.round(fontPx * LINE_HEIGHT);
  const strokeW = Math.max(2, Math.round(fontPx * STROKE_RATIO));

  ctx.font = `800 ${fontPx}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const maxWidth = W * (1 - 2 * pct(SIDE_PAD_PCT));
  const lines = wrap(ctx, slide.text || '', maxWidth);
  const blockH = lines.length * lineHeight;
  const startY = (H - blockH) / 2; // vertically centered, matching the preview
  const x = W / 2;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    // Paint stroke first, fill on top — same effect as CSS paint-order: stroke fill.
    ctx.strokeStyle = 'black';
    ctx.lineWidth = strokeW;
    ctx.strokeText(lines[i], x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(lines[i], x, y);
  }

  return canvas.toDataURL('image/png');
}

export async function renderSlideshow(show: Slideshow): Promise<string[]> {
  const out: string[] = [];
  for (const slide of show.slides) {
    out.push(await renderSlide(slide));
  }
  return out;
}
