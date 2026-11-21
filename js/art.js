// Рисунки glowbag: средства-стикеры, косметичка, рваная бумага, дудлы
import { C } from './data.js';

const WINE = C.wine;
const DISPLAY = "Bricolage Grotesque, Rubik, sans-serif";
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const SWATCHES = [C.pink, C.pink2, C.blue, C.blue2, C.cream, C.cream2, C.orange2, C.orange, C.wine, C.white];

function rgb(hex) {
  let c = (hex || '#FFD5FB').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
export function shade(hex, amt) {
  const f = v => Math.max(0, Math.min(255, Math.round(v + amt)));
  return '#' + rgb(hex).map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
const isDark = hex => { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45; };

export function nearestSwatch(hex) {
  if (!hex || !/^#?[0-9a-f]{3,6}$/i.test(hex)) return C.pink;
  const a = rgb(hex);
  let best = SWATCHES[0], bd = Infinity;
  for (const s of SWATCHES) {
    const b = rgb(s);
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// детерминированный «случай» — чтобы рваные края не прыгали при каждом рендере
export function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

// clip-path рваной бумаги в процентах — подходит для блока любого размера
export function tornClip(seed, amp = 2.4) {
  const r = rng(seed), pts = [];
  const j = () => (r() * amp).toFixed(2);
  const H = 20, V = 12;
  for (let i = 0; i <= H; i++) pts.push(`${(i * 100 / H).toFixed(1)}% ${j()}%`);
  for (let i = 1; i <= V; i++) pts.push(`${(100 - j()).toFixed(2)}% ${(i * 100 / V).toFixed(1)}%`);
  for (let i = H - 1; i >= 0; i--) pts.push(`${(i * 100 / H).toFixed(1)}% ${(100 - j()).toFixed(2)}%`);
  for (let i = V - 1; i >= 1; i--) pts.push(`${j()}% ${(i * 100 / V).toFixed(1)}%`);
  return `polygon(${pts.join(',')})`;
}

// большой рваный кусок цветной бумаги с белыми волокнами по краю
export function tornBlob(seed, fill) {
  const r = rng(seed);
  const c = [[r() * 14, r() * 14], [100 - r() * 14, r() * 14], [100 - r() * 14, 100 - r() * 14], [r() * 14, 100 - r() * 14]];
  let d = '';
  c.forEach((p, i) => {
    const q = c[(i + 1) % 4], n = 16;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = p[0] + (q[0] - p[0]) * t + (r() - .5) * 3.4;
      const y = p[1] + (q[1] - p[1]) * t + (r() - .5) * 3.4;
      d += (i || k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
  });
  d += 'Z';
  return `<svg viewBox="-4 -4 108 108" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="#fff" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="${d}" fill="${fill}"/></svg>`;
}

// ——— средства ———
function brandText(x, y, brand, ink, maxW, base = 13) {
  const b = (brand || '').trim().slice(0, 14);
  const size = Math.min(base, maxW / (Math.max(b.length, 3) * 0.56));
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="${size.toFixed(1)}" fill="${ink}" letter-spacing="-0.3">${esc(b)}</text>
    <rect x="${x - maxW * 0.28}" y="${y + 5}" width="${maxW * 0.56}" height="1.6" rx=".8" fill="${ink}" opacity=".35"/>
    <rect x="${x - maxW * 0.18}" y="${y + 9}" width="${maxW * 0.36}" height="1.6" rx=".8" fill="${ink}" opacity=".25"/>`;
}
const OUT = `stroke="${WINE}" stroke-opacity=".16" stroke-width="1.2"`;
const hi = (x, y, h) => `<rect x="${x}" y="${y}" width="5" height="${h}" rx="2.5" fill="#fff" opacity=".6"/>`;
const sh = (x, y, w, h, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${WINE}" opacity=".07"/>`;

const SHAPES = {
  pump: (c, d, l, ink, b) => `
    <path d="M54 14 h16 v7" fill="none" stroke="${d}" stroke-width="4" stroke-linecap="round"/>
    <rect x="38" y="9" width="20" height="12" rx="4" fill="${d}"/>
    <rect x="43" y="20" width="10" height="16" fill="${d}"/>
    <rect x="32" y="34" width="32" height="12" rx="4" fill="${d}"/>
    <rect x="17" y="44" width="64" height="90" rx="17" fill="${c}" ${OUT}/>
    ${sh(64, 52, 10, 74, 5)}${hi(24, 54, 60)}${brandText(49, 92, b, ink, 50)}`,
  bottle: (c, d, l, ink, b) => `
    <rect x="31" y="8" width="36" height="28" rx="7" fill="${d}"/>
    <rect x="37" y="34" width="24" height="10" fill="${l}" ${OUT}/>
    <rect x="19" y="42" width="60" height="92" rx="15" fill="${c}" ${OUT}/>
    ${sh(62, 50, 10, 76, 5)}${hi(26, 52, 62)}${brandText(49, 92, b, ink, 46)}`,
  spray: (c, d, l, ink, b) => `
    <rect x="35" y="10" width="28" height="12" rx="4" fill="${l}" ${OUT}/>
    <path d="M63 15 h8" stroke="${d}" stroke-width="3" stroke-linecap="round"/>
    <rect x="33" y="20" width="32" height="26" rx="6" fill="${d}"/>
    <rect x="21" y="44" width="56" height="90" rx="14" fill="${c}" ${OUT}/>
    ${sh(60, 52, 10, 74, 5)}${hi(28, 54, 60)}${brandText(49, 94, b, ink, 44)}`,
  dropper: (c, d, l, ink, b) => `
    <ellipse cx="49" cy="20" rx="11" ry="13" fill="${d}"/>
    <rect x="36" y="28" width="26" height="24" rx="5" fill="${shade(d, -20)}"/>
    <rect x="21" y="50" width="56" height="84" rx="16" fill="${c}" ${OUT}/>
    ${sh(60, 58, 10, 68, 5)}${hi(28, 60, 54)}${brandText(49, 96, b, ink, 44)}`,
  tube: (c, d, l, ink, b) => `
    <rect x="20" y="8" width="58" height="11" rx="2" fill="${shade(c, -18)}" ${OUT}/>
    <path d="M22 17 H76 L68 108 H30 Z" fill="${c}" ${OUT}/>
    <path d="M60 22 H70 L63 104 H56 Z" fill="${WINE}" opacity=".06"/>
    <rect x="29" y="106" width="40" height="28" rx="6" fill="${d}"/>
    ${hi(31, 26, 56)}${brandText(49, 60, b, ink, 40)}`,
  jar: (c, d, l, ink, b) => `
    <rect x="11" y="44" width="76" height="27" rx="8" fill="${d}"/>
    <path d="M20 50 v15 M30 50 v15 M40 50 v15 M50 50 v15 M60 50 v15 M70 50 v15 M78 50 v15" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>
    <rect x="15" y="68" width="68" height="64" rx="17" fill="${c}" ${OUT}/>
    ${sh(66, 74, 10, 50, 5)}${hi(22, 76, 42)}${brandText(49, 102, b, ink, 50)}`,
  stick: (c, d, l, ink, b) => `
    <rect x="29" y="8" width="40" height="42" rx="15" fill="${d}"/>
    <rect x="29" y="46" width="40" height="88" rx="11" fill="${c}" ${OUT}/>
    ${sh(56, 52, 8, 76, 4)}${hi(35, 56, 60)}${brandText(49, 94, b, ink, 32)}`,
  wand: (c, d, l, ink, b) => `
    <rect x="37" y="6" width="24" height="56" rx="9" fill="${d}"/>
    <rect x="35" y="58" width="28" height="76" rx="9" fill="${c}" ${OUT}/>
    ${hi(40, 66, 52)}${brandText(49, 100, b, ink, 24, 10)}`,
  compact: (c, d, l, ink, b) => `
    <circle cx="49" cy="80" r="41" fill="${c}" ${OUT}/>
    <circle cx="49" cy="80" r="31" fill="${l}"/>
    ${brandText(49, 82, b, ink, 46)}
    <path d="M28 64 q8 -12 22 -14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`,
  palette: (c, d, l, ink, b) => `
    <rect x="9" y="38" width="80" height="84" rx="13" fill="${c}" ${OUT}/>
    <circle cx="31" cy="63" r="12" fill="${C.pink2}"/><circle cx="67" cy="63" r="12" fill="${C.orange2}"/>
    <circle cx="31" cy="97" r="12" fill="${C.blue2}"/><circle cx="67" cy="97" r="12" fill="${C.orange}"/>`,
  lipstick: (c, d, l, ink, b) => `
    <path d="M38 40 V22 Q38 10 50 7 L62 16 V40 Z" fill="${d}"/>
    <rect x="34" y="38" width="32" height="20" rx="3" fill="${C.cream2}" ${OUT}/>
    <rect x="30" y="56" width="40" height="78" rx="9" fill="${c}" ${OUT}/>
    ${hi(36, 64, 56)}${brandText(50, 98, b, ink, 32)}`,
  perfume: (c, d, l, ink, b) => `
    <rect x="33" y="8" width="32" height="24" rx="7" fill="${d}"/>
    <rect x="41" y="30" width="16" height="12" fill="${l}" ${OUT}/>
    <rect x="13" y="40" width="72" height="92" rx="20" fill="${c}" ${OUT}/>
    <rect x="21" y="48" width="56" height="76" rx="14" fill="#fff" opacity=".28"/>
    ${brandText(49, 92, b, ink, 52)}`,
};

export function productArt(shape, color, brand) {
  const c = color || C.pink;
  const dark = isDark(c);
  const d = dark ? shade(c, 40) : (c.toUpperCase() === C.white || c.toUpperCase() === C.cream ? C.cream2 : shade(c, -34));
  const l = shade(c, 30);
  const ink = dark ? C.cream : WINE;
  const body = (SHAPES[shape] || SHAPES.bottle)(c, d, l, ink, brand);
  return `<svg class="art" viewBox="0 0 98 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

// ——— косметичка ———
export function bagBack() {
  return `<svg class="bag-back" viewBox="0 0 340 260" aria-hidden="true">
    <path d="M30 124 C28 72 50 52 84 50 L256 50 C290 52 312 72 310 124 Z" fill="#E3C9B8"/>
    <path d="M30 124 C28 72 50 52 84 50 L256 50 C290 52 312 72 310 124" fill="none" stroke="${WINE}" stroke-opacity=".12" stroke-width="2"/>
    <path d="M48 122 C50 86 70 74 98 72 L242 72 C270 74 290 86 292 122 Z" fill="${WINE}"/>
    <path d="M62 122 C66 98 82 90 104 88 L236 88 C258 90 274 98 278 122 Z" fill="#4A0000"/>
  </svg>`;
}

export function bagFront(key = 'b', label = 'glowbag') {
  return `<svg class="bag-front" viewBox="0 96 340 164" aria-hidden="true">
    <defs><pattern id="canvas-${key}" width="5" height="5" patternUnits="userSpaceOnUse">
      <path d="M0 2.5h5M2.5 0v5" stroke="${WINE}" stroke-opacity=".06" stroke-width="1"/></pattern></defs>
    <path d="M20 112 Q170 98 320 112 L331 222 Q333 254 298 254 L42 254 Q7 254 9 222 Z" fill="#EFDCCF"/>
    <path d="M20 112 Q170 98 320 112 L331 222 Q333 254 298 254 L42 254 Q7 254 9 222 Z" fill="url(#canvas-${key})"/>
    <path d="M9 214 Q170 244 331 214 L331 222 Q333 254 298 254 L42 254 Q7 254 9 222 Z" fill="${WINE}" opacity=".08"/>
    <path d="M26 128 Q170 114 314 128" fill="none" stroke="${WINE}" stroke-opacity=".22" stroke-width="1.6" stroke-dasharray="5 5"/>
    <path d="M20 112 Q170 98 320 112" fill="none" stroke="${C.orange}" stroke-width="9" stroke-linecap="round"/>
    <path d="M20 112 Q170 98 320 112" fill="none" stroke="${C.cream}" stroke-width="3" stroke-dasharray="2 3"/>
    <text x="170" y="198" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="50" fill="${WINE}" letter-spacing="-2">${esc(label)}</text>
    <g transform="translate(266 108) rotate(-6)">
      <rect x="-8" y="-5" width="16" height="12" rx="3" fill="${shade(C.orange, -20)}"/>
      <path d="M-7 6 L-10 36 Q0 46 10 36 L7 6 Z" fill="${C.orange}"/>
      <circle cy="30" r="3.4" fill="${C.cream}"/>
    </g>
  </svg>`;
}

// ——— дудлы ———
export function starPoints(r, inner = .45, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r * inner : r, a = Math.PI / n * i - Math.PI / 2;
    pts.push(`${(Math.cos(a) * rad).toFixed(1)},${(Math.sin(a) * rad).toFixed(1)}`);
  }
  return pts.join(' ');
}
export function starSVG(fill = C.orange, r = 14, cls = '', style = '') {
  const s = r * 2 + 12, p = starPoints(r);
  return `<svg class="star ${cls}" style="${style}" width="${s}" height="${s}" viewBox="${-s / 2} ${-s / 2} ${s} ${s}" aria-hidden="true">
    <polygon points="${p}" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>
    <polygon points="${p}" fill="${fill}" stroke-linejoin="round"/></svg>`;
}
export function sparkle(fill = C.orange, size = 34, cls = '', style = '') {
  return `<svg class="star ${cls}" style="${style}" width="${size}" height="${size}" viewBox="-20 -20 40 40" aria-hidden="true">
    <path d="M0 -18 C2 -6 6 -2 18 0 C6 2 2 6 0 18 C-2 6 -6 2 -18 0 C-6 -2 -2 -6 0 -18Z" fill="${fill}"/></svg>`;
}
export function outlineStar(stroke = C.orange, size = 46, cls = '', style = '') {
  return `<svg class="star ${cls}" style="${style}" width="${size}" height="${size}" viewBox="-24 -24 48 48" aria-hidden="true">
    <polygon points="${starPoints(20, .48)}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="${starPoints(16, .48)}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" transform="rotate(8)"/></svg>`;
}
export function smiley(stroke = C.orange, size = 46, style = '') {
  return `<svg class="star" style="${style}" width="${size}" height="${size}" viewBox="-24 -24 48 48" aria-hidden="true">
    <circle r="19" fill="${C.cream}" stroke="${stroke}" stroke-width="3"/><circle cx="-6" cy="-4" r="2.4" fill="${stroke}"/><circle cx="6" cy="-4" r="2.4" fill="${stroke}"/>
    <path d="M-9 5 Q0 14 9 5" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/></svg>`;
}
export function scribble(color = WINE, w = 150) {
  return `<svg class="scribble" width="${w}" height="18" viewBox="0 0 150 18" aria-hidden="true">
    <path d="M3 10 C40 4 90 3 146 6 M14 15 C50 10 96 10 132 12" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/></svg>`;
}
export function arrowDoodle(color = WINE, style = '') {
  return `<svg class="arrow-doodle" style="${style}" width="60" height="64" viewBox="0 0 60 64" aria-hidden="true">
    <path d="M10 6 C40 10 52 30 34 56" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M24 46 L34 57 L46 50" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
export function dashes(color = C.orange, style = '') {
  return `<svg class="dashes" style="${style}" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M6 30 L14 8 M18 32 L30 12" stroke="${color}" stroke-width="4" stroke-linecap="round"/></svg>`;
}
export function burst(text, fill = C.pink2) {
  const p = starPoints(52, .78, 14);
  const size = Math.min(17, 84 / (Math.max(text.length, 3) * 0.6));
  return `<svg class="burst" viewBox="-60 -60 120 120" aria-hidden="true">
    <polygon points="${p}" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>
    <polygon points="${p}" fill="${fill}"/>
    <text transform="rotate(-10)" text-anchor="middle" dominant-baseline="central" font-family="${DISPLAY}" font-weight="800" font-size="${size.toFixed(1)}" fill="${WINE}">${esc(text)}</text></svg>`;
}

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICONS = {
  home: I('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  bag: I('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  grid: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  routine: I('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>'),
  heart: I('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="3"'),
  up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2.6"'),
  camera: I('<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.6"/>'),
  sun: I('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  cloud: I('<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z"/>'),
  star: I('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  spark: I('<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/>'),
  shelf: I('<path d="M3 20h18M5 20V9M19 20V9M3 9h18"/><path d="M8 9V5h3v4M13 9V6h3v3"/>'),
  drop: I('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  leaf: I('<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19l7-7"/>'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
};
