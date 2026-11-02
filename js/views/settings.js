// Settings: your name, the Google Sheet connection, appearance, demo mode, data tools.
import { html, fmtTime, todayISO, downloadFile, plural } from '../util.js';
import { registerActions, rerender } from '../registry.js';
import { settings, DEFAULT_API_URL, DEFAULT_API_KEY, applyTheme } from '../settings.js';
import { api, writeLocal } from '../api.js';
import { store, sync, resetCache, pendingCount } from '../store.js';
import { icon, toast, confirmBox, chip } from '../ui.js';
import { demoDB } from '../demo.js';

export const title = () => 'Settings';

export function render() {
  const s = settings.all();
  const st = store.status;
  const local = api.mode() === 'local';
  const version = api.version;
  const custom = (s.apiUrl && s.apiUrl !== DEFAULT_API_URL) || (s.apiKey && s.apiKey !== DEFAULT_API_KEY);
  return html`
    <div class="settings-grid">
      <section class="panel">
        <div class="panel-head"><h2>${icon('user', 18)} You</h2></div>
        <form class="panel-body grid-2" data-form="me">
          <label class="field"><span>Your name</span><input name="userName" value="${s.userName}" autocomplete="name" placeholder="Shown as “Prepared by”…"><small class="hint">Printed on reports and written to the sheet’s audit log with each change.</small></label>
          <label class="field"><span>Hospital name</span><input name="hospital" value="${s.hospital}" autocomplete="organization"><small class="hint">Printed when the logo can’t be loaded.</small></label>
          <div class="span-2"><button type="submit" class="btn btn-primary" data-action="set-save" data-form="me">Save</button></div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('link', 18)} Google Sheet</h2>
          ${local ? chip('Demo mode', 'blue') : version === 2 ? chip('Connected · new script', 'green') : version === 1 ? chip('Connected · old script', 'amber') : chip('Not reached yet', '')}</div>
        <div class="panel-body stack">
          <dl class="kv">
            <dt>Last update</dt><dd>${st.lastSync ? fmtTime(st.lastSync) : 'Never'}</dd>
            <dt>Waiting to send</dt><dd>${plural(pendingCount(), 'change')}${st.error ? html` · <span class="warn-text">${st.error}</span>` : ''}</dd>
          </dl>
          ${!local && version === 1 ? html`
            <div class="banner" style="margin:0">${icon('alert', 18)}<span>The sheet still runs the old Apps Script. Everything works, but deploying the new
              <b>google-apps-script/Code.gs</b> makes saving faster and safer (one request per save, locking, dates and file numbers kept as typed). Steps are in <b>google-apps-script/SETUP.md</b>.</span></div>` : ''}
          ${custom ? html`
            <div class="banner" style="margin:0">${icon('alert', 18)}<span>This device uses its own link instead of the team’s link built into the app.</span>
              <button type="button" class="btn btn-sm btn-primary" data-action="set-builtin">Use the built-in link</button></div>`
            : html`<p class="muted">${icon('checkCircle', 16)} The team’s link is built into the app. Every device connects on its own, with nothing to paste.</p>`}
          <div class="row"><button type="button" class="btn" data-action="set-test">${icon('refresh', 16)} Test connection</button></div>
          <details ${custom ? 'open' : ''}>
            <summary class="muted small">Use a different link (advanced)</summary>
            <form class="grid-2" data-form="conn" style="margin-top:12px">
              <label class="field span-2"><span>Apps Script web app link</span><input name="apiUrl" class="ltr" value="${s.apiUrl}" placeholder="${DEFAULT_API_URL}" spellcheck="false" autocomplete="off"><small class="hint">Only for testing another script. Leave empty to use the built-in link.</small></label>
              <label class="field"><span>Access key</span><input name="apiKey" class="ltr" value="${s.apiKey}" placeholder="${DEFAULT_API_KEY}" spellcheck="false" autocomplete="off"></label>
              <div class="row span-2"><button type="submit" class="btn btn-primary" data-action="set-save" data-form="conn">Save link</button></div>
            </form>
          </details>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('sun', 18)} Appearance</h2></div>
        <div class="panel-body"><div class="pills" role="group" aria-label="Theme">
          ${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => html`<button type="button" class="pill ${s.theme === k ? 'active' : ''}" aria-pressed="${String(s.theme === k)}" data-action="set-theme" data-t="${k}">${l}</button>`)}
        </div></div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('grid', 18)} Demo mode</h2>${local ? chip('On', 'blue') : chip('Off', '')}</div>
        <div class="panel-body stack">
          <p class="muted">Try the app with made-up patients. Nothing is sent to the Google Sheet while demo mode is on.</p>
          <div class="row">
            ${local ? html`<button type="button" class="btn btn-primary" data-action="set-demo" data-on="0">Turn off and use the Google Sheet</button><button type="button" class="btn" data-action="set-demo-reset">Reset demo data</button>`
              : html`<button type="button" class="btn" data-action="set-demo" data-on="1">Turn on demo mode</button>`}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('download', 18)} Data</h2></div>
        <div class="panel-body row">
          <button type="button" class="btn" data-action="sync-now">${icon('refresh', 16)} Refresh from the sheet</button>
          <button type="button" class="btn" data-action="set-backup">${icon('download', 16)} Download a backup (JSON)</button>
          <button type="button" class="btn btn-ghost" data-action="set-reset">${icon('trash', 16)} Clear this device’s copy</button>
        </div>
      </section>
    </div>`;
}

function readForm(name) {
  const form = document.querySelector(`[data-form="${name}"]`);
  return Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
}

registerActions({
  'set-save': async (el) => {
    const name = el.dataset.form;
    const data = readForm(name);
    settings.set(data);
    toast('Saved');
    if (name === 'conn') { api.version = 0; await sync().catch((e) => toast(e.message, { type: 'error' })); }
    rerender();
  },
  'set-builtin': async () => {
    settings.set({ apiUrl: '', apiKey: '' });
    toast('Using the built-in link');
    api.version = 0;
    await sync().catch((e) => toast(e.message, { type: 'error' }));
    rerender();
  },
  'set-test': async () => {
    try { const r = await api.ping(); toast(r.version === 'demo' ? 'Demo mode is on' : `Connected (${r.version === 2 ? 'new' : 'old'} script) in ${r.ms} ms`); }
    catch (e) { toast(e.message, { type: 'error' }); }
    rerender();
  },
  'set-theme': (el) => { settings.set({ theme: el.dataset.t }); applyTheme(); rerender(); },
  'set-demo': async (el) => {
    const on = el.dataset.on === '1';
    if (pendingCount() && !(await confirmBox(`${plural(pendingCount(), 'change')} have not reached the sheet yet. Switch anyway? They stay queued for when you switch back.`, { confirm: 'Switch' }))) return;
    if (on && !localStorage.getItem('jk.v2.localdb')) writeLocal(demoDB());
    settings.set({ localMode: on });
    location.reload();
  },
  'set-demo-reset': async () => {
    if (!(await confirmBox('Replace the demo data with fresh made-up patients?', { confirm: 'Reset demo' }))) return;
    writeLocal(demoDB());
    resetCache();
    await sync();
    toast('Demo data reset');
    rerender();
  },
  'set-backup': () => {
    downloadFile(`medsched-backup-${todayISO()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), data: store.data }, null, 1), 'application/json');
  },
  'set-reset': async () => {
    if (pendingCount()) { toast('Some changes have not reached the sheet yet. Wait until “All changes saved”.', { type: 'error' }); return; }
    if (!(await confirmBox('This removes the copy kept in this browser and downloads everything again from the sheet. Nothing in the sheet is deleted.', { confirm: 'Clear and reload' }))) return;
    resetCache();
    await sync().catch((e) => toast(e.message, { type: 'error' }));
    toast('Reloaded from the sheet');
    rerender();
  },
});
