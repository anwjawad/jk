// Small shared helpers: safe HTML templating, normalisation, local dates.

// ---------- HTML ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s ?? ''));

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

// Every interpolated value is escaped unless it is already Raw (i.e. built by html``).
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

// Multi-line user text → escaped HTML with <br>.
export const multiline = (s) => raw(esc(s).replace(/\n/g, '<br>'));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- normalisation ----------
const AR = '٠١٢٣٤٥٦٧٨٩';
export const latinDigits = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => AR.indexOf(d));
export const cleanText = (v) => latinDigits(v).replace(/[‏‎]/g, '').replace(/\s+/g, ' ').trim();
export const normFile = (v) => latinDigits(v).toUpperCase().replace(/\s+/g, '');
export const phoneDigits = (v) => latinDigits(v).replace(/[^\d+]/g, '');

// Folds case, Arabic letter variants and diacritics so search is forgiving.
export function fold(v) {
  return cleanText(v)
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

export function matches(q, ...fields) {
  const nq = fold(q);
  if (!nq) return true;
  return fields.some((f) => fold(f).includes(nq));
}

// Text that was saved as UTF-8 but read back as Latin-1 ("Ù…ØªØ§Ø¨Ø¹Ø©") → Arabic again.
export function fixMojibake(s) {
  const str = String(s ?? '');
  if (!/[ÃØÙÚÛ][\u0080-ÿ]/.test(str)) return str;
  try {
    const bytes = new Uint8Array([...str].map((c) => {
      const code = c.charCodeAt(0);
      return code < 256 ? code : CP1252[code] ?? 63;
    }));
    const out = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return out;
  } catch { return str; }
}
// Windows-1252 characters that live above U+00FF.
const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

// ---------- dates (all ISO yyyy-mm-dd, local time) ----------
const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };

export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
export const todayISO = () => toISO(new Date());
export const nowISO = () => new Date().toISOString();
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const weekday = (s) => parseISO(s).getDay();
export const monthKey = (s) => String(s || '').slice(0, 7);
export const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

// Accepts what Google Sheets and Excel hand back: ISO dates, ISO timestamps
// (a date cell read as UTC midnight of the local day), dd/mm/yyyy, Date objects.
export function normDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return isNaN(v) ? '' : toISO(v);
  const s = String(v).trim();
  if (isISODate(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : toISO(d); }
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  const d = new Date(s);
  return isNaN(d) ? '' : toISO(d);
}

const FORMATS = {
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  med: { weekday: 'short', day: 'numeric', month: 'short' },
  short: { day: 'numeric', month: 'short' },
  full: { day: '2-digit', month: '2-digit', year: 'numeric' },
  dayName: { weekday: 'long' },
  month: { month: 'long', year: 'numeric' },
  time: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
};
const fmtCache = {};
const F = (kind) => (fmtCache[kind] ||= new Intl.DateTimeFormat('en-GB', FORMATS[kind]));

export function fmtDate(s, style = 'short') {
  if (!isISODate(s)) return s || '';
  return F(style).format(parseISO(s));
}
export const fmtMonth = (key) => (key ? F('month').format(parseISO(key + '-01')) : '');
export function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' || /^\d+$/.test(ts) ? Number(ts) : ts);
  return isNaN(d) ? '' : F('time').format(d);
}
export const dayName = (s) => (isISODate(s) ? F('dayName').format(parseISO(s)) : '');

export function relDay(s) {
  if (!isISODate(s)) return '';
  const n = diffDays(todayISO(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n < 0 ? `${-n} days ago` : `in ${n} days`;
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------- misc ----------
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const uniq = (arr) => [...new Set(arr)];
export const byText = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'en', { sensitivity: 'base' });

export function readFileAs(file, as = 'arrayBuffer') {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    if (as === 'dataURL') r.readAsDataURL(file); else if (as === 'text') r.readAsText(file); else r.readAsArrayBuffer(file);
  });
}

let xlsxPromise;
export function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => { xlsxPromise = null; reject(new Error('Could not load the Excel reader. Check your internet connection and try again.')); };
    document.head.append(s);
  });
  return xlsxPromise;
}

let mammothPromise;
export function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  mammothPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/mammoth.browser.min.js';
    s.onload = () => resolve(window.mammoth);
    s.onerror = () => { mammothPromise = null; reject(new Error('Could not load the Word reader.')); };
    document.head.append(s);
  });
  return mammothPromise;
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.append(ta); ta.select();
  try { document.execCommand('copy'); return Promise.resolve(); } catch (e) { return Promise.reject(e); } finally { ta.remove(); }
}

export function downloadFile(name, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
