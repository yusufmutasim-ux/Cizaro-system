"use client";
import { FORMATS, type BrandBook, type Format, type Layout } from "./brand";
import type { FileDTO } from "./brands";

// Draws a finished ad: the visual, an on-brand overlay, the copy in the brand fonts, the CTA and the real logo.

export type ComposeInput = {
  format: string;
  image: HTMLImageElement | null;
  headline: string;
  subheadline: string;
  cta: string;
  layout: Layout;
  brandName: string;
  book: BrandBook;
  logo: HTMLImageElement | null;
  fonts: BrandFonts;
};
export type BrandFonts = { heading: string; body: string };

const FALLBACK = `"IBM Plex Sans Arabic", "Inter", system-ui, sans-serif`;
const AR = /[؀-ۿ]/;

export const sizeOf = (format: string) => FORMATS[(format in FORMATS ? format : "1:1") as Format];

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImage(src: string | null | undefined) {
  if (!src) return Promise.resolve(null);
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    imageCache.set(src, p);
  }
  return p;
}

const fontCache = new Map<string, Promise<BrandFonts>>();
/** Loads the brand's uploaded font files (or Google Fonts by name) and returns CSS font stacks for heading and body. */
export function loadBrandFonts(brandId: string, book: BrandBook, files: FileDTO[]) {
  const fontFiles = files.filter((f) => f.kind === "font" && /^font\/|octet-stream/.test(f.mime) && /\.(ttf|otf|woff2?)$/i.test(f.name));
  const key = brandId + "|" + book.headingFont + "|" + book.bodyFont + "|" + fontFiles.map((f) => f.id).join(",");
  let p = fontCache.get(key);
  if (!p) {
    p = (async () => {
      const pickFile = (name: string, fallbackIdx: number) => {
        const n = name.trim().toLowerCase().replace(/\s+/g, "");
        return (n && fontFiles.find((f) => f.name.toLowerCase().replace(/[\s_-]+/g, "").includes(n))) || fontFiles[fallbackIdx] || null;
      };
      const family = async (name: string, idx: number, alias: string) => {
        const file = pickFile(name, idx);
        if (file) {
          try {
            const face = new FontFace(alias, `url(${file.url})`);
            document.fonts.add(await face.load());
            return `"${alias}", ${FALLBACK}`;
          } catch {}
        }
        const g = name.trim();
        if (g && /^[\w\s-]+$/.test(g)) {
          const id = "gf-" + g.replace(/\s+/g, "-");
          if (!document.getElementById(id)) {
            const l = document.createElement("link");
            l.id = id; l.rel = "stylesheet";
            l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(g)}:wght@400;500;700;800&display=swap`;
            document.head.appendChild(l);
            await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 2500); });
          }
          await document.fonts.load(`700 40px "${g}"`).catch(() => {});
          return `"${g}", ${FALLBACK}`;
        }
        return FALLBACK;
      };
      const heading = await family(book.headingFont, 0, `bh-${brandId}`);
      const body = await family(book.bodyFont || book.headingFont, fontFiles.length > 1 ? 1 : 0, `bb-${brandId}`);
      await document.fonts.ready;
      return { heading, body };
    })();
    fontCache.set(key, p);
  }
  return p;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export const onColor = (hex: string) => (luminance(hex) > 0.45 ? "#111111" : "#FFFFFF");
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > max && line) { out.push(line); line = w; } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

/** Fits text into a box by shrinking the size until it takes at most `maxLines`. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxW: number, maxLines: number) {
  let px = start;
  for (; px > start * 0.45; px -= Math.max(1, start * 0.04)) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines) return { px, lines };
  }
  ctx.font = font(px);
  return { px, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function compose(canvas: HTMLCanvasElement, d: ComposeInput) {
  const { w: W, h: H } = sizeOf(d.format);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const L = d.layout;
  const palette = d.book.colors;
  const primary = palette.find((c) => c.role === "primary")?.hex ?? palette[0]?.hex ?? "#6D5EFC";
  const panel = palette.find((c) => c.role === "background")?.hex ?? primary;
  const story = d.format === "9:16";
  const padX = W * 0.075;
  const safeTop = story ? H * 0.14 : H * 0.07;
  const safeBottom = story ? H * 0.2 : H * 0.075;

  // Visual
  const visualH = L.preset === "split" ? Math.round(H * 0.62) : H;
  if (d.image) cover(ctx, d.image, 0, 0, W, visualH);
  else {
    const g = ctx.createLinearGradient(0, 0, W, visualH);
    g.addColorStop(0, primary); g.addColorStop(1, L.accentColor);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, visualH);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = `600 ${W * 0.03}px ${FALLBACK}`; ctx.textAlign = "center"; ctx.direction = "rtl";
    ctx.fillText("الصورة لسه ما اتولدتش", W / 2, visualH * 0.42);
  }

  // Overlay for legibility
  if (L.preset === "bottom") {
    const g = ctx.createLinearGradient(0, H * 0.38, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (L.preset === "top") {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0.75)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (L.preset === "center") {
    ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(0, 0, W, H);
  } else if (L.preset === "split") {
    ctx.fillStyle = panel; ctx.fillRect(0, visualH, W, H - visualH);
  }

  // Copy
  if (L.preset !== "clean" && (d.headline || d.subheadline || d.cta)) {
    const rtl = AR.test(d.headline + d.subheadline + d.cta);
    const center = L.preset === "center";
    const maxW = W - padX * 2;
    const unit = Math.min(W, H * 0.9);
    const head = fit(ctx, d.headline, (px) => `800 ${px}px ${d.fonts.heading}`, unit * (L.preset === "minimal" ? 0.058 : 0.085), L.preset === "minimal" ? maxW * 0.7 : maxW, 3);
    const sub = d.subheadline ? fit(ctx, d.subheadline, (px) => `500 ${px}px ${d.fonts.body}`, unit * 0.036, maxW, 3) : { px: 0, lines: [] as string[] };
    const ctaPx = unit * 0.034;
    const lh = 1.22;
    const gap = unit * 0.026;
    const ctaH = d.cta ? ctaPx * 2.5 : 0;
    const blockH = head.lines.length * head.px * lh + (sub.lines.length ? gap + sub.lines.length * sub.px * 1.4 : 0) + (d.cta ? gap * 1.6 + ctaH : 0);

    let y: number;
    if (L.preset === "top") y = safeTop + (L.logoPosition.startsWith("top") ? unit * 0.13 : 0);
    else if (L.preset === "center") y = (H - blockH) / 2;
    else if (L.preset === "split") y = visualH + (H - visualH - blockH) / 2 - (story ? H * 0.03 : 0);
    else y = H - safeBottom - blockH - (L.logoPosition.startsWith("bottom") ? unit * 0.11 : 0);

    const x = center ? W / 2 : rtl ? W - padX : padX;
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = center ? "center" : rtl ? "right" : "left";
    ctx.textBaseline = "top";
    const shadow = L.preset !== "split";
    ctx.shadowColor = shadow ? "rgba(0,0,0,0.35)" : "transparent"; ctx.shadowBlur = shadow ? unit * 0.02 : 0;

    ctx.fillStyle = L.textColor;
    ctx.font = `800 ${head.px}px ${d.fonts.heading}`;
    for (const line of head.lines) { ctx.fillText(line, x, y); y += head.px * lh; }
    if (sub.lines.length) {
      y += gap;
      ctx.font = `500 ${sub.px}px ${d.fonts.body}`;
      ctx.fillStyle = rgba(L.textColor, 0.88);
      for (const line of sub.lines) { ctx.fillText(line, x, y); y += sub.px * 1.4; }
    }
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    if (d.cta) {
      y += gap * 1.6;
      ctx.font = `700 ${ctaPx}px ${d.fonts.body}`;
      const tw = ctx.measureText(d.cta).width;
      const bw = tw + ctaPx * 2.6;
      const bx = center ? W / 2 - bw / 2 : rtl ? W - padX - bw : padX;
      roundRect(ctx, bx, y, bw, ctaH, ctaH / 2);
      ctx.fillStyle = L.accentColor; ctx.fill();
      ctx.fillStyle = onColor(L.accentColor);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.cta, bx + bw / 2, y + ctaH / 2 + ctaPx * 0.04);
    }
  }

  // Logo
  if (L.logoPosition !== "none") {
    const m = W * 0.055;
    const top = L.logoPosition.startsWith("top");
    const right = L.logoPosition.endsWith("right");
    const yTop = top ? Math.max(m, story ? safeTop * 0.55 : m) : 0;
    if (d.logo) {
      const maxW = W * 0.17, maxH = W * 0.1;
      const s = Math.min(maxW / d.logo.naturalWidth, maxH / d.logo.naturalHeight);
      const lw = d.logo.naturalWidth * s, lh = d.logo.naturalHeight * s;
      const lx = right ? W - m - lw : m;
      const ly = top ? yTop : H - (story ? safeBottom * 0.55 : m) - lh;
      ctx.drawImage(d.logo, lx, ly, lw, lh);
    } else {
      const px = W * 0.032;
      ctx.font = `800 ${px}px ${d.fonts.heading}`;
      ctx.direction = AR.test(d.brandName) ? "rtl" : "ltr";
      ctx.textAlign = right ? "right" : "left"; ctx.textBaseline = "top";
      ctx.fillStyle = L.preset === "split" && !top ? onColor(panel) : "#FFFFFF";
      ctx.fillText(d.brandName, right ? W - m : m, top ? yTop : H - (story ? safeBottom * 0.55 : m) - px);
    }
  }
}

export function canvasBlob(canvas: HTMLCanvasElement, type = "image/png", q = 0.92) {
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), type, q));
}
