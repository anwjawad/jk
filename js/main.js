// App shell: routing, rendering, event delegation, global search, sync status.
import { $, $$, debounce, esc, fmtDate, fmtTime } from './util.js';
import { settings, applyTheme } from './settings.js';
import { api } from './api.js';
import { store, subscribe, loadCache, sync, flush } from './store.js';
import { lists, search, openTasks, fuDone } from './model.js';
import { actions, changes, hooks } from './registry.js';
import { closeMenus, toggleMenu, toast, icon } from './ui.js';
import * as today from './views/today.js';
import * as portcath from './views/portcath.js';
import * as admissions from './views/admissions.js';
import * as followup from './views/followup.js';
import * as tumorboard from './views/tumorboard.js';
import * as clinic from './views/clinic.js';
import * as calendar from './views/calendar.js';
import * as importer from './views/importer.js';
import * as settingsView from './views/settings.js';

const ROUTES = { today, portcath, admissions, followup, tumorboard, clinic, calendar, import: importer, settings: settingsView };
const STABLE = new Set(['settings', 'import']);   // forms that background changes must not wipe
let current = 'today';

// ---------- rendering ----------
let pendingRender = false;
function render() {
  const view = ROUTES[current];
  const root = $('#view');
  // Don't wipe a field the user is typing in.
  const ae = document.activeElement;
  if (ae && root.contains(ae) && ae.matches('input:not([type=checkbox]):not([type=radio]), textarea') && ae.dataset.change && ae.value !== ae.defaultValue) {
    pendingRender = true;
    return;
  }
  const key = ae?.dataset?.key;
  const sel = key && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;
  const scroll = window.scrollY;
  root.innerHTML = String(view.render());
  view.mount?.(root);
  if (key) {
    const el = root.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch { /* not a text input */ } }
  }
  window.scrollTo(0, scroll);
  renderChrome();
}
document.addEventListener('focusout', () => { if (pendingRender) { pendingRender = false; setTimeout(render, 0); } });

function renderChrome() {
  const view = ROUTES[current];
  const title = view.title();
  $('#page-title').textContent = title;
  $('#page-sub').textContent = view.sub?.() || '';
  document.title = `${title} · MedSched`;
  $$('.nav a').forEach((a) => {
    const on = a.dataset.route === current;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const L = lists();
  const count = (k, n) => { const el = $(`[data-count=${k}]`); if (el) el.textContent = n || ''; };
  count('portcath', L.awaiting.length);
  count('admissions', L.admissions.filter((a) => a.date === L.today).length);
  count('followup', L.followup.filter((f) => f.date === L.today && !fuDone(f)).length);
  count('tumorboard', L.tumorboard.reduce((n, p) => n + openTasks(p).length, 0));
  count('clinic', L.clinic.filter((c) => c.date === L.today).length);
  $('[data-count=portcath]').title = L.awaiting.length ? `${L.awaiting.length} past bookings still need “Port done” or “Not done”` : '';
  const user = settings.get('userName');
  $('#user-chip').textContent = user ? `Signed as ${user}` : '';
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-btn').innerHTML = String(icon(dark ? 'sun' : 'moon', 19));
  renderBanner();
}

function renderBanner() {
  const b = $('#banner');
  if (api.mode() === 'local') {
    b.className = 'banner info';
    b.innerHTML = `${icon('alert', 18)}<span>Demo mode: data stays in this browser only and is not shared with the team. <a href="#/settings">Turn it off in Settings</a>.</span>`;
    b.hidden = false;
  } else if (store.status.state === 'error' && store.status.pending) {
    b.className = 'banner';
    b.innerHTML = `${icon('alert', 18)}<span>${esc(store.status.pending)} change(s) are waiting to reach the Google Sheet. They are kept on this device and sent automatically. <a href="#" data-action="sync-now">Try now</a></span>`;
    b.hidden = false;
  } else b.hidden = true;
}

function renderStatus() {
  const pill = $('#sync-pill');
  const s = store.status;
  const labels = {
    idle: 'Connecting…', syncing: 'Updating…', saving: `Saving ${s.pending}…`, saved: 'All changes saved',
    error: `${s.pending} not saved yet — retrying`, offline: `Offline — ${s.pending} waiting`,
  };
  pill.dataset.state = s.state;
  pill.querySelector('.label').textContent = api.mode() === 'local' && s.state === 'saved' ? 'Saved in this browser' : labels[s.state] || '';
  pill.title = s.error || (s.lastSync ? `Last update ${fmtTime(s.lastSync)} — click to refresh now` : 'Refresh now');
  renderBanner();
}

const scheduleRender = debounce(render, 30);
hooks.rerender = scheduleRender;
subscribe((evt) => { renderStatus(); if (evt?.statusOnly) return; if (!STABLE.has(current)) scheduleRender(); else renderChrome(); });

// ---------- routing ----------
function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const name = ROUTES[path] ? path : 'today';
  current = name;
  ROUTES[name].onRoute?.(new URLSearchParams(query || ''));
  document.body.classList.remove('rail-open');
  closeMenus();
  render();
  $('#view').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
hooks.navigate = (r, params) => {
  const target = `#/${r}${params ? '?' + new URLSearchParams(params) : ''}`;
  if (location.hash === target) route(); else location.hash = target;
};
window.addEventListener('hashchange', route);

// ---------- event delegation ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!e.target.closest('.menu-wrap')) closeMenus();
  if (!e.target.closest('.global-search')) $('#global-results').hidden = true;
  if (!el) return;
  const name = el.dataset.action;
  if (name === 'menu') { e.preventDefault(); toggleMenu(el); return; }
  if (name === 'toggle-rail') { document.body.classList.toggle('rail-open'); return; }
  if (name === 'sync-now') { e.preventDefault(); manualSync(); return; }
  if (name === 'toggle-theme') { toggleTheme(); return; }
  const fn = actions[name];
  if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  closeMenus();
  try { await fn(el, e); } catch (err) { console.error(err); toast(`Something went wrong: ${err.message}`, { type: 'error' }); }
  if (!STABLE.has(current)) scheduleRender();
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = changes[el.dataset.change];
  if (!fn) return;
  el.defaultValue = el.value;
  try { fn(el, e); } catch (err) { console.error(err); toast(`Something went wrong: ${err.message}`, { type: 'error' }); }
  if (!STABLE.has(current)) scheduleRender();
});

// Enter in a page form (Settings) runs its save button instead of reloading the page.
document.addEventListener('submit', (e) => {
  const form = e.target.closest('#view form');
  if (!form) return;
  e.preventDefault();
  form.querySelector('[type=submit][data-action]')?.click();
});

const inputRender = debounce(render, 160);
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  changes[el.dataset.input]?.(el, e);
  inputRender();
});

// Enter/Space on non-button elements that carry an action (calendar days are buttons already).
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); gInput.focus(); gInput.select(); }
  if (e.key === 'Escape') { closeMenus(); document.body.classList.remove('rail-open'); }
});

function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  settings.set({ theme: dark ? 'light' : 'dark' });
  applyTheme();
  renderChrome();
}

// ---------- global patient search ----------
const gInput = $('#global-search');
const gResults = $('#global-results');
let gIndex = 0;
function renderGlobal() {
  const q = gInput.value.trim();
  if (q.length < 2) { gResults.hidden = true; return; }
  const hits = search(q);
  gIndex = 0;
  gResults.innerHTML = hits.length
    ? hits.map((h, i) => `<button type="button" class="result ${i === 0 ? 'hi' : ''}" role="option" data-route="${h.route}" data-id="${esc(h.row.id)}">
        <span class="nm">${esc(h.row.name || 'Unnamed')}</span>
        <span class="where"><span class="chip outline">${esc(h.label)}</span></span>
        <span class="meta">${esc([h.row.fileNumber && `File ${h.row.fileNumber}`, h.row.date ? fmtDate(h.row.date, 'med') : h.table === 'portcath' ? 'Waiting list' : '', h.row.phone].filter(Boolean).join(' · '))}</span>
      </button>`).join('')
    : '<div class="empty" style="padding:16px"><strong>No match</strong><p>Try part of the name, the file number or the phone.</p></div>';
  gResults.hidden = false;
}
gInput.addEventListener('input', debounce(renderGlobal, 110));
gInput.addEventListener('focus', renderGlobal);
gInput.addEventListener('keydown', (e) => {
  const items = $$('.result', gResults);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    gIndex = (gIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((it, i) => it.classList.toggle('hi', i === gIndex));
    items[gIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { e.preventDefault(); items[gIndex]?.click(); }
  else if (e.key === 'Escape') { gResults.hidden = true; gInput.blur(); }
});
gResults.addEventListener('click', (e) => {
  const b = e.target.closest('.result');
  if (!b) return;
  gResults.hidden = true;
  gInput.value = '';
  gInput.blur();
  ROUTES[b.dataset.route].focusRecord?.(b.dataset.id);
  hooks.navigate(b.dataset.route, { focus: b.dataset.id });
});

// ---------- sync ----------
async function manualSync() {
  try { await sync(); toast('Up to date with the Google Sheet'); }
  catch (e) { toast(`Could not update: ${e.message}`, { type: 'error' }); }
}
window.addEventListener('online', () => { flush(); sync().catch(() => {}); });
setInterval(() => { if (document.visibilityState === 'visible') sync().catch(() => {}); }, 90000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync().catch(() => {}); });
document.addEventListener('settings-changed', (e) => { if ('theme' in (e.detail || {})) applyTheme(); renderChrome(); renderStatus(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); renderChrome(); });
window.addEventListener('beforeunload', (e) => { if (store.status.pending) { e.preventDefault(); e.returnValue = ''; } });

// ---------- boot ----------
for (const el of $$('[data-icon]')) el.innerHTML = String(icon(el.dataset.icon, el.closest('.nav') ? 19 : 18));
applyTheme();
const hadCache = loadCache();
route();
renderStatus();
sync().catch((e) => { if (!hadCache) toast(`Could not load data: ${e.message}`, { type: 'error' }); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
