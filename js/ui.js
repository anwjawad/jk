// UI building blocks: icons, dialogs, toasts, menus, small renderers.
import { html, raw, esc, $, $$, fmtDate, relDay, todayISO, addDays, phoneDigits } from './util.js';

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>',
  word: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M9.5 12l1 5 1.5-3.5 1.5 3.5 1-5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4M12 17v.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2Z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  chevL: '<path d="m14 6-6 6 6 6"/>',
  chevR: '<path d="m10 6 6 6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.3 2.6 3.8 5.5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  calCheck: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  forward: '<path d="M4 17V9a3 3 0 0 1 3-3h11M14 2l4 4-4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z"/>',
  port: '<circle cx="12" cy="12" r="4"/><path d="M12 8V3M12 21v-5M8 12H3M21 12h-5"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/>',
  board: '<path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  stethoscope: '<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
export const icon = (name, size = 18) => raw(`<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`);

// ---------- toasts ----------
export function toast(message, { type = 'ok', undo, timeout = 5000 } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${type === 'error' ? icon('alert', 18) : icon('checkCircle', 18)}<span>${esc(message)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 180); };
  if (undo) el.querySelector('button').onclick = () => { undo(); kill(); };
  $('#toasts').append(el);
  setTimeout(kill, type === 'error' ? 9000 : timeout);
}

// ---------- dialogs ----------
function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.multi !== undefined) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); }
      else o[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ''; }
    else o[el.name] = String(el.value).trim();
  }
  return o;
}

// Resolves with the form's values, or null when cancelled.
// validate(data, form) may return an error string (or {field, message}) to keep it open.
export function modal({ title, subtitle = '', body, primary = 'Save', secondary = 'Cancel', danger = false, size = 'm', onMount, validate, extraButtons = '' }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = `modal modal-${size}`;
    dlg.innerHTML = `
      <form class="modal-form" novalidate>
        <header>
          <div><h2>${esc(title)}</h2>${subtitle ? `<p class="modal-sub">${esc(subtitle)}</p>` : ''}</div>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
        </header>
        <div class="modal-body"><div class="form-error" role="alert" hidden></div>${String(body)}</div>
        <footer>
          ${secondary ? `<button type="button" class="btn" data-close>${esc(secondary)}</button>` : ''}
          ${String(extraButtons)}
          ${primary ? `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="primary">${esc(primary)}</button>` : ''}
        </footer>
      </form>`;
    document.body.append(dlg);
    const form = dlg.querySelector('form');
    let settled = false;
    const done = (v) => { if (settled) return; settled = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) done(null); });
    $$('[data-close]', dlg).forEach((b) => (b.onclick = () => done(null)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = formData(form);
      data._submitter = e.submitter?.value || 'primary';
      const err = validate ? await validate(data, form) : null;
      if (err) {
        const box = $('.form-error', form);
        const msg = typeof err === 'string' ? err : err.message;
        box.textContent = msg; box.hidden = false;
        const field = typeof err === 'object' && err.field ? form.elements[err.field] : null;
        (field || box).focus?.();
        box.scrollIntoView({ block: 'nearest' });
        return;
      }
      done(data);
    });
    dlg.showModal();
    const first = form.querySelector('[autofocus]') || form.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([readonly]), .modal-body textarea, .modal-body select');
    if (first && matchMedia('(pointer: fine)').matches) first.focus();
    onMount?.(dlg, done);
  });
}

export async function confirmBox(message, { title = 'Are you sure?', confirm = 'Continue', danger = false } = {}) {
  const r = await modal({ title, body: html`<p class="confirm-text">${message}</p>`, primary: confirm, danger });
  return r !== null;
}

// ---------- menus ----------
export function closeMenus() { $$('.menu').forEach((m) => (m.hidden = true)); $$('[data-action=menu]').forEach((b) => b.setAttribute('aria-expanded', 'false')); }
export function toggleMenu(btn) {
  const menu = btn.parentElement.querySelector('.menu');
  const wasHidden = menu.hidden;
  closeMenus();
  menu.hidden = !wasHidden;
  btn.setAttribute('aria-expanded', String(wasHidden));
  if (wasHidden) menu.querySelector('button')?.focus();
}
export const menu = (items, label = 'More actions') => html`
  <div class="menu-wrap">
    <button type="button" class="icon-btn" data-action="menu" aria-haspopup="true" aria-expanded="false" aria-label="${label}">${icon('more')}</button>
    <div class="menu" role="menu" hidden>${items}</div>
  </div>`;

// ---------- small renderers ----------
export const chip = (text, tone = '') => html`<span class="chip ${tone}">${text}</span>`;

export const empty = (title, text = '', action = '') => html`
  <div class="empty"><div class="empty-ring">${icon('calendar', 22)}</div><strong>${title}</strong>${text ? html`<p>${text}</p>` : ''}${action}</div>`;

export function telLinks(phone) {
  if (!phone) return '';
  const d = phoneDigits(phone);
  // Local mobile numbers: 059/056 are Palestinian networks (+970), other 05x are +972.
  const wa = /^0(59|56)/.test(d) ? '970' + d.slice(1) : d.startsWith('0') ? '972' + d.slice(1) : d.replace(/^\+/, '');
  return html`<span class="tel"><a class="ltr" href="tel:${d}" title="Call">${icon('phone', 14)} ${phone}</a><a class="wa" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp ${phone}">${icon('whatsapp', 15)}</a></span>`;
}

// Prev / date / next / Today control. `action` receives data-to="yyyy-mm-dd".
export function dateNav(date, action, { label } = {}) {
  const today = todayISO();
  return html`
    <div class="date-nav">
      <button type="button" class="icon-btn" data-action="${action}" data-to="${addDays(date, -1)}" aria-label="Previous day">${icon('chevL')}</button>
      <label class="date-pick">
        <span class="date-main">${label || fmtDate(date, 'long')}</span>
        <span class="date-rel">${relDay(date)}</span>
        <input type="date" value="${date}" data-change="${action}" aria-label="Pick a date">
      </label>
      <button type="button" class="icon-btn" data-action="${action}" data-to="${addDays(date, 1)}" aria-label="Next day">${icon('chevR')}</button>
      ${date !== today ? html`<button type="button" class="btn btn-sm" data-action="${action}" data-to="${today}">Today</button>` : ''}
    </div>`;
}

// Text field with suggestions from earlier entries.
export function datalist(id, values) {
  return html`<datalist id="${id}">${values.map((v) => html`<option value="${v}"></option>`)}</datalist>`;
}

export const field = (label, control, { hint = '', span = '' } = {}) => html`
  <label class="field ${span}"><span>${label}</span>${control}${hint ? html`<small class="hint">${hint}</small>` : ''}</label>`;
