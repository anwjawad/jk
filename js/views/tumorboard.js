// Tumor board follow-up: each patient carries a checklist of tasks.
import { html, $, $$, matches, byText, plural, cleanText, fmtDate, todayISO, uid, readFileAs, loadMammoth, esc } from '../util.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { get, create, upsert, remove, restore, batch } from '../store.js';
import { lists, TASK_TYPES, openTasks, knownPhysicians } from '../model.js';
import { icon, modal, confirmBox, toast, menu, chip, empty, datalist } from '../ui.js';
import { printDialog } from '../print.js';
import { parseText, parseHTML } from '../wordimport.js';

export const title = () => 'Tumor Board Follow-up';
export const sub = () => {
  const L = lists();
  return `${plural(L.tumorboard.length, 'patient')} · ${L.tumorboard.reduce((n, p) => n + openTasks(p).length, 0)} open tasks`;
};

let focusId = '';
export function onRoute(params) {
  const id = params.get('focus');
  if (id && get('tumorboard', id)) { focusId = id; ui.tbFilter = 'all'; ui.tbQuery = ''; }
}
export function mount(root) {
  if (!focusId) return;
  const id = focusId;
  focusId = '';
  const el = root.querySelector(`[data-row="${CSS.escape(id)}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
  profile(get('tumorboard', id));
}
export const focusRecord = (id) => { focusId = id; };

const FILTERS = [['all', 'All'], ['open', 'Open tasks'], ['done', 'All tasks done'], ['none', 'No tasks']];

export function render() {
  const L = lists();
  const rows = L.tumorboard
    .filter((p) => {
      const open = openTasks(p).length;
      const total = (p.tasks || []).length;
      return ui.tbFilter === 'all' || (ui.tbFilter === 'open' ? open > 0 : ui.tbFilter === 'done' ? total > 0 && open === 0 : total === 0);
    })
    .filter((p) => matches(ui.tbQuery, p.name, p.fileNumber, p.physician, p.diagnosis, p.notes))
    .sort((a, b) => openTasks(b).length - openTasks(a).length || byText(a.name, b.name));
  return html`
    <div class="toolbar">
      <div class="pills" role="group" aria-label="Filter">${FILTERS.map(([k, l]) => html`<button type="button" class="pill ${ui.tbFilter === k ? 'active' : ''}" aria-pressed="${String(ui.tbFilter === k)}" data-action="tb-filter" data-f="${k}">${l}</button>`)}</div>
      <span class="spacer"></span>
      <label class="search-box"><span class="sr-only">Search tumor board</span>${icon('search', 16)}<input class="input" type="search" value="${ui.tbQuery}" data-input="tb-query" data-key="tb-q" placeholder="Name, MRN, doctor, diagnosis…" autocomplete="off"></label>
      <button type="button" class="btn" data-action="tb-import">${icon('word', 17)} Import from Word</button>
      <button type="button" class="btn btn-primary" data-action="tb-add">${icon('plus', 17)} Add patient</button>
    </div>
    <section class="panel">
      ${rows.length ? rows.map((p) => {
        const open = openTasks(p).length;
        const total = (p.tasks || []).length;
        return html`
          <div class="tb-card" data-row="${p.id}">
            <div style="min-width:0">
              <div class="row"><button type="button" class="name-btn" style="font-size:15px" data-action="tb-open" data-id="${p.id}">${p.name}</button>
                ${total === 0 ? chip('No tasks', '') : open === 0 ? chip(`All ${total} done`, 'green') : chip(`${open} of ${total} open`, 'amber')}</div>
              <div class="small muted">MRN <span class="ltr">${p.fileNumber || '—'}</span>${p.age ? ` · ${p.age} yrs` : ''} · ${p.physician || 'Unassigned'}</div>
              ${p.diagnosis ? html`<div class="dx">${p.diagnosis}</div>` : ''}
              ${open ? html`<div class="row" style="margin-top:6px">${openTasks(p).slice(0, 4).map((t) => chip(taskTitle(t), 'outline'))}</div>` : ''}
            </div>
            <div class="row" style="align-items:flex-start">
              <button type="button" class="btn btn-sm" data-action="tb-open" data-id="${p.id}">Open</button>
              ${menu(html`<button type="button" data-action="tb-open" data-id="${p.id}">${icon('edit', 16)} Profile &amp; tasks</button><hr><button type="button" class="danger" data-action="tb-delete" data-id="${p.id}">${icon('trash', 16)} Delete</button>`)}
            </div>
          </div>`;
      }) : empty(L.tumorboard.length ? 'No patients match' : 'No tumor board patients yet', L.tumorboard.length ? 'Change the filter or the search.' : 'Import the board list from Word, or add patients one by one.')}
    </section>`;
}

const taskTitle = (t) => t.title || TASK_TYPES[t.type]?.ar || 'Task';

async function addPatient() {
  const r = await modal({
    title: 'Add tumor board patient',
    body: html`
      <div class="grid-2">
        <label class="field span-2"><span>Patient name <span class="req">*</span></span><input name="name" autocomplete="off"></label>
        <label class="field"><span>MRN / file number</span><input name="fileNumber" class="ltr" autocomplete="off"></label>
        <label class="field"><span>Age</span><input name="age" type="number" min="0" max="120" inputmode="numeric"></label>
        <label class="field span-2"><span>Physician <span class="req">*</span></span><input name="physician" list="tb-docs" autocomplete="off"></label>
        <label class="field span-2"><span>Diagnosis / brief history <span class="req">*</span></span><textarea name="diagnosis" rows="3"></textarea></label>
      </div>${datalist('tb-docs', knownPhysicians())}`,
    primary: 'Add patient',
    validate: (d) => {
      if (!cleanText(d.name)) return { field: 'name', message: 'Enter the patient’s name.' };
      if (!cleanText(d.physician)) return { field: 'physician', message: 'Enter the physician.' };
      if (!cleanText(d.diagnosis)) return { field: 'diagnosis', message: 'Enter the diagnosis.' };
      if (d.fileNumber && lists().tumorboard.some((p) => cleanText(p.fileNumber) === cleanText(d.fileNumber))) return { field: 'fileNumber', message: 'A patient with this MRN is already on the list.' };
      return null;
    },
  });
  if (!r) return;
  const row = create('tumorboard', { name: cleanText(r.name), fileNumber: cleanText(r.fileNumber), age: r.age, physician: cleanText(r.physician), diagnosis: r.diagnosis, notes: '', tasks: [] });
  toast(`${row.name} added`);
  focusId = row.id;
}

// Profile: demographics + task checklist, all in one dialog that stays open.
function profile(p) {
  if (!p) return;
  const id = p.id;
  const tasksHTML = () => {
    const cur = get('tumorboard', id);
    const tasks = cur?.tasks || [];
    return tasks.length ? `<ul class="task-list">${tasks.map((t) => `
      <li class="task ${t.status === 'completed' ? 'completed' : ''}">
        <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} data-t-toggle="${esc(t.id)}" aria-label="Done: ${esc(taskTitle(t))}">
        <div><div class="t-title rtl-text">${esc(taskTitle(t))}</div>
          ${t.details || t.due ? `<div class="t-meta">${esc(t.details || '')}${t.due ? `${t.details ? ' · ' : ''}Due ${esc(fmtDate(t.due, 'med'))}` : ''}</div>` : ''}
          ${t.notes ? `<div class="t-meta rtl-text">${esc(t.notes)}</div>` : ''}</div>
        <button type="button" class="icon-btn sm" data-t-del="${esc(t.id)}" aria-label="Delete task">${icon('trash', 16)}</button>
      </li>`).join('')}</ul>` : `<p class="muted small">No tasks yet. Add the first one below.</p>`;
  };
  return modal({
    title: p.name,
    subtitle: `MRN ${p.fileNumber || '—'} · ${p.physician || 'Unassigned'}`,
    size: 'l',
    body: html`
      <div class="cols-2">
        <div class="stack">
          <h3 style="font-size:14px">Patient</h3>
          <div class="grid-2">
            <label class="field span-2"><span>Name <span class="req">*</span></span><input name="name" value="${p.name}" autocomplete="off"></label>
            <label class="field"><span>MRN</span><input name="fileNumber" class="ltr" value="${p.fileNumber}" autocomplete="off"></label>
            <label class="field"><span>Age</span><input name="age" type="number" value="${p.age}" inputmode="numeric"></label>
            <label class="field span-2"><span>Physician <span class="req">*</span></span><input name="physician" list="tb-docs2" value="${p.physician}" autocomplete="off"></label>
            <label class="field span-2"><span>Diagnosis <span class="req">*</span></span><textarea name="diagnosis" rows="3">${p.diagnosis}</textarea></label>
            <label class="field span-2"><span>Discussion points</span><textarea name="notes" rows="3" class="rtl-text">${p.notes}</textarea></label>
          </div>
          ${datalist('tb-docs2', knownPhysicians())}
        </div>
        <div class="stack">
          <div class="row-between"><h3 style="font-size:14px">Follow-up tasks</h3><button type="button" class="btn btn-sm" data-print-profile>${icon('print', 15)} Print</button></div>
          <div data-tasks>${''}</div>
          <div class="panel" style="padding:12px;display:grid;gap:10px;box-shadow:none">
            <div class="grid-2">
              <label class="field"><span>Task</span><select data-new-type>${Object.entries(TASK_TYPES).map(([k, t]) => html`<option value="${k}">${t.en} · ${t.ar}</option>`)}</select></label>
              <label class="field"><span>Due date</span><input type="date" data-new-due></label>
              <label class="field span-2" data-other hidden><span>Task title</span><input data-new-title autocomplete="off"></label>
              <label class="field span-2" data-clinic hidden><span>Clinic</span><input data-new-clinic autocomplete="off" placeholder="e.g. Oncology, Radiotherapy…"></label>
              <label class="field span-2"><span>Note</span><input data-new-notes autocomplete="off"></label>
            </div>
            <button type="button" class="btn btn-primary btn-sm" data-add-task>${icon('plus', 15)} Add task</button>
          </div>
        </div>
      </div>`,
    primary: 'Save patient details',
    secondary: 'Close',
    onMount: (dlg) => {
      const box = $('[data-tasks]', dlg);
      const redraw = () => { box.innerHTML = tasksHTML(); };
      redraw();
      const type = $('[data-new-type]', dlg);
      const syncType = () => { $('[data-other]', dlg).hidden = type.value !== 'other'; $('[data-clinic]', dlg).hidden = type.value !== 'clinic_booking'; };
      type.addEventListener('change', syncType); syncType();
      const save = (tasks) => upsert('tumorboard', { id, tasks });
      box.addEventListener('change', (e) => {
        const tid = e.target.dataset.tToggle;
        if (!tid) return;
        const cur = get('tumorboard', id);
        save(cur.tasks.map((t) => (t.id === tid ? { ...t, status: e.target.checked ? 'completed' : 'pending', completedAt: e.target.checked ? todayISO() : '' } : t)));
        redraw();
      });
      box.addEventListener('click', async (e) => {
        const tid = e.target.closest('[data-t-del]')?.dataset.tDel;
        if (!tid) return;
        const cur = get('tumorboard', id);
        const before = cur.tasks;
        save(before.filter((t) => t.id !== tid));
        redraw();
        toast('Task deleted', { undo: () => { save(before); redraw(); } });
      });
      $('[data-add-task]', dlg).addEventListener('click', () => {
        const k = type.value;
        const def = TASK_TYPES[k];
        let title = def.ar;
        if (k === 'other') title = cleanText($('[data-new-title]', dlg).value) || def.ar;
        if (k === 'clinic_booking') { const c = cleanText($('[data-new-clinic]', dlg).value) || 'General'; title = `${def.ar} - ${c}`; }
        const due = $('[data-new-due]', dlg).value;
        const details = '';
        const cur = get('tumorboard', id);
        save([...(cur.tasks || []), { id: uid(), type: k, title, details, due, notes: cleanText($('[data-new-notes]', dlg).value), status: 'pending', createdAt: todayISO() }]);
        $$('[data-new-title], [data-new-clinic], [data-new-notes], [data-new-due]', dlg).forEach((i) => (i.value = ''));
        redraw();
      });
      $$('[data-new-title], [data-new-clinic], [data-new-notes]', dlg).forEach((i) => i.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); $('[data-add-task]', dlg).click(); }
      }));
      $('[data-print-profile]', dlg).addEventListener('click', () => printProfile(id));
    },
    validate: (d) => (!cleanText(d.name) ? { field: 'name', message: 'Enter the name.' } : !cleanText(d.physician) ? { field: 'physician', message: 'Enter the physician.' } : !cleanText(d.diagnosis) ? { field: 'diagnosis', message: 'Enter the diagnosis.' } : null),
  }).then((r) => {
    if (!r) return;
    upsert('tumorboard', { id, name: cleanText(r.name), fileNumber: cleanText(r.fileNumber), age: r.age, physician: cleanText(r.physician), diagnosis: r.diagnosis, notes: r.notes });
    toast('Patient details saved');
  });
}

function printProfile(id) {
  const p = get('tumorboard', id);
  const tasks = p.tasks || [];
  return printDialog((r) => {
    const chosen = tasks.filter((t) => (r.tasks || []).includes(t.id));
    return {
      title: 'Tumor Board Follow-up Report', subtitle: 'Clinical care plan', fileDate: todayISO(),
      summary: [{ label: '', value: `${p.name} · MRN ${p.fileNumber || '—'} · ${p.age ? p.age + ' yrs · ' : ''}${p.physician}` }],
      sections: [
        { heading: 'Patient', columns: [{ label: 'Diagnosis', width: '55%' }, { label: 'Discussion notes' }], rows: [[p.diagnosis, p.notes]] },
        { heading: 'Follow-up checklist', columns: [{ label: 'Task / follow-up', width: '40%' }, { label: 'Status', width: '15%', align: 'c' }, { label: 'Notes' }], rows: chosen.map((t) => [`${taskTitle(t)}${t.details ? '\n' + t.details : ''}${t.due ? '\nDue ' + fmtDate(t.due, 'full') : ''}`, t.status === 'completed' ? 'Completed' : 'Pending', t.notes]), empty: 'No tasks selected.' },
      ],
    };
  }, {
    title: 'Print patient profile',
    extra: tasks.length ? html`<div class="field"><span>Tasks to include</span>${tasks.map((t) => html`<label class="check"><input type="checkbox" name="tasks" data-multi value="${t.id}" checked> <span class="rtl-text">${taskTitle(t)}</span> <span class="muted small">${t.status === 'completed' ? 'done' : 'pending'}</span></label>`)}</div>` : '',
  });
}

async function importWord() {
  let parsed = [];
  const r = await modal({
    title: 'Import tumor board list from Word',
    subtitle: 'Upload the .docx file, or paste the table copied from Word.',
    size: 'xl',
    body: html`
      <div class="grid-2">
        <label class="drop" style="padding:22px">${icon('word', 26)}<strong>Choose a .docx file</strong><span class="small muted">The first table in the document is read.</span><input type="file" accept=".docx" data-docx class="sr-only"></label>
        <label class="field"><span>…or paste the table here</span><textarea data-paste rows="5" placeholder="Copy the rows from Word and paste…"></textarea><button type="button" class="btn btn-sm" data-parse style="justify-self:start;margin-top:6px">Read pasted text</button></label>
      </div>
      <div data-preview></div>`,
    primary: 'Import selected',
    onMount: (dlg) => {
      const prev = $('[data-preview]', dlg);
      const show = (list) => {
        parsed = list;
        const existing = new Set(lists().tumorboard.map((p) => cleanText(p.fileNumber)).filter(Boolean));
        prev.innerHTML = list.length ? `<p class="small" style="margin:6px 0"><b>${list.length}</b> patients found. Check the names, then import.</p>
          <div class="preview"><table class="data"><thead><tr><th><span class="sr-only">Import</span></th><th>Name</th><th>MRN</th><th>Age</th><th>Physician</th><th>Diagnosis</th></tr></thead><tbody>
          ${list.map((p, i) => { const dup = p.fileNumber && existing.has(cleanText(p.fileNumber)); return `<tr><td><input type="checkbox" name="pick" data-multi value="${i}" ${dup ? '' : 'checked'} aria-label="Import row ${i + 1}"></td>
            <td><input class="cell-input" name="n${i}" value="${esc(p.name)}"></td><td><input class="cell-input ltr" name="f${i}" value="${esc(p.fileNumber)}" style="width:110px"></td>
            <td><input class="cell-input" name="a${i}" value="${esc(p.age)}" style="width:64px"></td><td><input class="cell-input" name="d${i}" value="${esc(p.physician)}"></td>
            <td class="small" style="max-width:360px">${esc(p.diagnosis)}${dup ? ' <span class="chip amber">MRN already listed</span>' : ''}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="warn-text">No patients were found. Make sure the table has a number in the first column.</p>';
      };
      $('[data-docx]', dlg).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const mammoth = await loadMammoth();
          const res = await mammoth.convertToHtml({ arrayBuffer: await readFileAs(file) });
          show(parseHTML(res.value));
        } catch (err) { prev.innerHTML = `<p class="warn-text">Could not read the file: ${esc(err.message)}</p>`; }
      });
      $('[data-parse]', dlg).addEventListener('click', () => show(parseText($('[data-paste]', dlg).value)));
    },
    validate: (d) => (!parsed.length ? 'Load a file or paste the table first.' : !(d.pick || []).length ? 'Select at least one patient.' : null),
  });
  if (!r) return;
  let n = 0;
  batch(() => {
    for (const i of r.pick) {
      const p = parsed[Number(i)];
      create('tumorboard', { ...p, name: cleanText(r[`n${i}`]) || p.name, fileNumber: cleanText(r[`f${i}`]), age: r[`a${i}`], physician: cleanText(r[`d${i}`]) || 'Unassigned', tasks: [] });
      n++;
    }
  });
  toast(`Imported ${plural(n, 'patient')}`);
}

registerActions({
  'tb-filter': (el) => { ui.tbFilter = el.dataset.f; },
  'tb-add': () => addPatient(),
  'tb-open': (el) => profile(get('tumorboard', el.dataset.id)),
  'tb-import': () => importWord(),
  'tb-delete': async (el) => {
    const p = get('tumorboard', el.dataset.id);
    if (!(await confirmBox(`Delete ${p.name} and all their tasks from the tumor board list?`, { title: 'Delete patient?', confirm: 'Delete', danger: true }))) return;
    const row = remove('tumorboard', p.id);
    toast(`${p.name} deleted`, { undo: () => restore('tumorboard', row) });
  },
});
registerChanges({ 'tb-query': (el) => { ui.tbQuery = el.value; } });
