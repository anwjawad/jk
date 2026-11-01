// User preferences kept on this device.
const KEY = 'jk.v2.settings';

// The Apps Script web app that reads and writes the team's Google Sheet.
export const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbw0K-FmJxZKhWhzQnGZQ_BLA7wRBtt70i2YadtaE9A6AgElnlXeTE8G7ZxkhXeHV-Vq/exec';
export const DEFAULT_API_KEY = 'medsched-2026-key-abc123';

const DEFAULTS = {
  apiUrl: '',            // '' = DEFAULT_API_URL
  apiKey: '',            // '' = DEFAULT_API_KEY
  localMode: false,      // demo database in this browser only
  userName: '',          // "Prepared by" on prints and in the sheet's audit log
  theme: 'system',       // system | light | dark
  hospital: 'Augusta Victoria Hospital',
  physicianColors: {},   // clinic: doctor → colour
  lastPhysician: '',
};

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { cache = { ...DEFAULTS }; }
  // First run: carry over the name and theme the old version stored.
  if (!localStorage.getItem(KEY)) {
    if (localStorage.getItem('medsched_dark_mode') === 'true') cache.theme = 'dark';
    try {
      const colors = JSON.parse(localStorage.getItem('medsched_clinic_physician_colors') || '{}');
      if (colors && typeof colors === 'object') cache.physicianColors = colors;
    } catch { /* ignore */ }
  }
  return cache;
}

export const settings = {
  get: (k) => load()[k],
  all: () => ({ ...load() }),
  set(patch) {
    cache = { ...load(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ }
    document.dispatchEvent(new CustomEvent('settings-changed', { detail: patch }));
  },
};

export function applyTheme() {
  const t = settings.get('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0B1416' : '#F4F7F7');
}
