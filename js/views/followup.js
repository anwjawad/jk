// WhatsApp & call follow-up: one list per day, results typed inline.
import { html, todayISO, fmtDate, addDays, dayName, matches, byText, plural, cleanText, copyText, isISODate } from '../util.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { get, create, upsert, remove, restore } from '../store.js';
import { lists, fuDone } from '../model.js';
import { icon, modal, confirmBox, toast, menu, chip, empty, dateNav, telLinks } from '../ui.js';
import { printDialog } from '../print.js';

export const title = () => 'WhatsApp & Call Follow-up';
export const sub = () => fmtDate(ui.fuDate || todayISO(), 'long');

let focusId = '';
export function onRoute(params) {
  if (!ui.fuDate) ui.fuDate = todayISO();
  const id = params.get('focus');
  const f = id && get('followup', id);
  if (f) { focusId = id; if (f.date) ui.fuDate = f.date; ui.fuShow = 'all'; ui.fuQuery = ''; }
}
export function mount(root) {
  if (!focusId) return;
  const el = root.querySelector(`[data-row="${CSS.escape(focusId)}"]`);
  focusId = '';
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
}
export const focusRecord = (id) => { focusId = id; };

const QUICK = ['Done', 'No answer', 'Wrong number', 'Will call back'];

export function render() {
  const L = lists();
  const date = ui.fuDate;
  const day = L.followup.filter((f) => f.date === date);
  const overdue = L.followup.filter((f) => f.date && f.date < todayISO() && !fuDone(f));
  const open = day.filter((f) => !fuDone(f));
  const rows = (ui.fuShow === 'overdue' ? overdue : day)
    .filter((f) => ui.fuShow !== 'open' || !fuDone(f))
    .filter((f) => matches(ui.fuQuery, f.name, f.fileNumber, f.phone, f.task, f.taskResult))
    .sort((a, b) => Number(fuDone(a)) - Number(fuDone(b)) || String(a.date).localeCompare(String(b.date)) || byText(a.name, b.name));
  const pct = day.length ? Math.round(((day.length - open.length) / day.length) * 100) : 0;

  return html`
    <div class="toolbar">
      ${dateNav(date, 'fu-date')}
      <span class="spacer"></span>
      <button type="button" class="btn" data-action="fu-copy">${icon('copy', 16)} Copy list</button>
      <button type="button" class="btn" data-action="fu-print">${icon('print', 17)} Print</button>
      <button type="button" class="btn btn-primary" data-action="fu-add">${icon('plus', 17)} Add follow-up</button>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>${plural(day.length, 'patient')} · ${fmtDate(date, 'med')}</h2>
          <div class="row small muted" style="margin-top:4px"><span>${day.length - open.length} done · ${open.length} open</span>
            ${day.length ? html`<span class="meter" style="width:140px;margin:0" aria-hidden="true"><span style="width:${pct}%;background:var(--green)"></span></span>` : ''}</div>
        </div>
        <div class="row">
          <div class="pills" role="group" aria-label="Show">
            ${[['all', 'All'], ['open', 'Open'], ['overdue', `Overdue ${overdue.length}`]].map(([k, l]) => html`<button type="button" class="pill ${ui.fuShow === k ? 'active' : ''}" aria-pressed="${String(ui.fuShow === k)}" data-action="fu-show" data-s="${k}">${l}</button>`)}
          </div>
          <label class="search-box"><span class="sr-only">Search follow-ups</span>${icon('search', 16)}<input class="input" type="search" value="${ui.fuQuery}" data-input="fu-query" data-key="fu-q" placeholder="Name, file, task…" autocomplete="off"></label>
        </div>
      </div>
      ${rows.length ? html`
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Patient</th><th>Phone</th><th>Task</th><th style="min-width:260px">Result</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${rows.map((f) => html`<tr data-row="${f.id}">
            <td><button type="button" class="name-btn" data-action="fu-edit" data-id="${f.id}">${f.name}</button><div class="file">${f.fileNumber}</div>${ui.fuShow === 'overdue' ? chip(fmtDate(f.date, 'med'), 'orange') : ''}</td>
            <td class="nowrap">${telLinks(f.phone) || html`<span class="muted">—</span>`}</td>
            <td class="rtl-text" style="max-width:320px">${f.task}</td>
            <td>
              <input class="cell-input ${fuDone(f) ? 'done' : ''}" value="${f.taskResult || ''}" data-change="fu-result" data-id="${f.id}" data-key="fu-r-${f.id}" placeholder="Type the result…" aria-label="Result for ${f.name}" autocomplete="off">
              <div class="row" style="margin-top:5px">${QUICK.map((q) => html`<button type="button" class="pill" style="min-height:26px;padding:1px 9px" data-action="fu-quick" data-id="${f.id}" data-q="${q}">${q}</button>`)}</div>
            </td>
            <td>${menu(html`
              <button type="button" data-action="fu-edit" data-id="${f.id}">${icon('edit', 16)} Edit</button>
              <button type="button" data-action="fu-tomorrow" data-id="${f.id}">${icon('forward', 16)} Move to tomorrow</button>
              <hr><button type="button" class="danger" data-action="fu-delete" data-id="${f.id}">${icon('trash', 16)} Delete</button>`)}</td>
          </tr>`)}</tbody>
        </table></div>`
      : empty(day.length || ui.fuShow === 'overdue' ? 'Nothing to show' : `No follow-ups on ${fmtDate(date, 'long')}`, ui.fuShow === 'overdue' ? 'No open follow-ups from earlier days.' : 'Add patients to call, or import them from Excel.')}
    </section>`;
}

async function edit(f) {
  const isNew = !f;
  f ||= { date: ui.fuDate };
  const r = await modal({
    title: isNew ? 'Add follow-up' : 'Edit follow-up',
    body: html`
      <div class="grid-2">
        <label class="field span-2"><span>Patient name <span class="req">*</span></span><input name="name" value="${f.name || ''}" autocomplete="off"></label>
        <label class="field"><span>Phone <span class="req">*</span></span><input name="phone" type="tel" class="ltr" value="${f.phone || ''}" autocomplete="off" placeholder="059…"></label>
        <label class="field"><span>File number / ID <span class="req">*</span></span><input name="fileNumber" class="ltr" value="${f.fileNumber || ''}" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span>Follow-up date <span class="req">*</span></span><input name="date" type="date" value="${f.date || ''}"></label>
        <span></span>
        <label class="field span-2"><span>Requested task <span class="req">*</span></span><textarea name="task" rows="2">${f.task || ''}</textarea></label>
        <label class="field span-2"><span>Result</span><textarea name="taskResult" rows="2">${f.taskResult || ''}</textarea></label>
      </div>`,
    primary: isNew ? 'Add follow-up' : 'Save changes',
    validate: (d) => {
      if (!cleanText(d.name)) return { field: 'name', message: 'Enter the patient’s name.' };
      if (!cleanText(d.phone)) return { field: 'phone', message: 'Enter a phone number to call.' };
      if (!cleanText(d.fileNumber)) return { field: 'fileNumber', message: 'Enter the file number or ID.' };
      if (!isISODate(d.date)) return { field: 'date', message: 'Choose the follow-up date.' };
      if (!cleanText(d.task)) return { field: 'task', message: 'Write what needs to be done.' };
      return null;
    },
  });
  if (!r) return;
  const fields = { name: cleanText(r.name), phone: cleanText(r.phone), fileNumber: cleanText(r.fileNumber), date: r.date, task: r.task, taskResult: r.taskResult };
  if (isNew) { const row = create('followup', fields); focusId = row.id; toast(`${row.name} added`); }
  else { upsert('followup', { id: f.id, ...fields }); toast('Saved'); }
  ui.fuDate = r.date;
}

function dayRows() {
  return lists().followup.filter((f) => f.date === ui.fuDate).sort((a, b) => byText(a.name, b.name));
}

registerActions({
  'fu-date': (el) => { ui.fuDate = el.dataset.to; if (ui.fuShow === 'overdue') ui.fuShow = 'all'; },
  'fu-show': (el) => { ui.fuShow = el.dataset.s; },
  'fu-add': () => edit(null),
  'fu-edit': (el) => edit(get('followup', el.dataset.id)),
  'fu-quick': (el) => {
    const f = get('followup', el.dataset.id);
    upsert('followup', { id: f.id, taskResult: el.dataset.q });
    toast(`${f.name}: ${el.dataset.q}`);
  },
  'fu-tomorrow': (el) => {
    const f = get('followup', el.dataset.id);
    const to = addDays(f.date || todayISO(), 1);
    upsert('followup', { id: f.id, date: to });
    toast(`${f.name} moved to ${fmtDate(to, 'med')}`);
  },
  'fu-delete': async (el) => {
    const f = get('followup', el.dataset.id);
    if (!(await confirmBox(`Delete the follow-up for ${f.name}?`, { title: 'Delete follow-up?', confirm: 'Delete', danger: true }))) return;
    const row = remove('followup', f.id);
    toast(`${f.name} deleted`, { undo: () => restore('followup', row) });
  },
  'fu-copy': async () => {
    const rows = dayRows();
    if (!rows.length) { toast('Nothing to copy for this day.', { type: 'error' }); return; }
    const text = ['File/ID Number\tRequested Task', ...rows.map((f) => `${f.fileNumber}\t${String(f.task).replace(/\s+/g, ' ')}`)].join('\n');
    await copyText(text);
    toast(`Copied ${plural(rows.length, 'row')} — paste into Excel, Word or WhatsApp`);
  },
  'fu-print': () => printDialog(() => {
    const rows = dayRows();
    return {
      title: 'WhatsApp & Call Follow-up', when: fmtDate(ui.fuDate, 'full'), whenSub: dayName(ui.fuDate), fileDate: ui.fuDate,
      summary: [{ label: 'patients', value: rows.length }, { label: 'done', value: rows.filter(fuDone).length }],
      sections: [{ heading: '', columns: [{ label: 'Patient name', width: '20%' }, { label: 'Phone', width: '13%' }, { label: 'File / ID no.', width: '12%' }, { label: 'Requested task', width: '25%' }, { label: 'Task result' }], rows: rows.map((f) => [f.name, f.phone, f.fileNumber, f.task, f.taskResult]) }],
      signature: false,
    };
  }, { title: 'Print follow-up list' }),
});
registerChanges({
  'fu-date': (el) => { if (el.value) ui.fuDate = el.value; },
  'fu-query': (el) => { ui.fuQuery = el.value; },
  'fu-result': (el) => {
    const f = get('followup', el.dataset.id);
    if (f && el.value.trim() !== String(f.taskResult || '')) { upsert('followup', { id: f.id, taskResult: el.value.trim() }); toast('Result saved'); }
  },
});
