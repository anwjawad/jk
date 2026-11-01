// Calendar: every list on one month grid, and a summary of the chosen day.
import { html, todayISO, fmtDate, fmtMonth, monthKey, addMonths, parseISO, dayName, relDay, plural, byText } from '../util.js';
import { registerActions, ui } from '../registry.js';
import { lists, patientsOn, isSessionDay, fuDone, doctorName, TRIAGE } from '../model.js';
import { icon, chip, empty } from '../ui.js';
import { printDialog } from '../print.js';

export const title = () => 'Calendar';
export const sub = () => fmtMonth(ui.calMonth || monthKey(todayISO()));

export function onRoute() {
  if (!ui.calDay) ui.calDay = todayISO();
  if (!ui.calMonth) ui.calMonth = monthKey(ui.calDay);
}

const MODS = [
  { k: 'pc', label: 'Port cath', short: 'Port', color: 'var(--brand)', soft: 'var(--brand-soft)' },
  { k: 'adm', label: 'Admissions', short: 'Adm.', color: 'var(--blue)', soft: 'var(--blue-soft)' },
  { k: 'fu', label: 'Follow-up', short: 'Calls', color: 'var(--amber)', soft: 'var(--amber-soft)' },
  { k: 'cl', label: 'Clinic', short: 'Clinic', color: 'var(--orange)', soft: 'var(--orange-soft)' },
];

function dayData(date) {
  const L = lists();
  return {
    pc: patientsOn(date).filter((p) => p.status !== 'cancelled'),
    adm: L.admissions.filter((a) => a.date === date),
    fu: L.followup.filter((f) => f.date === date),
    cl: L.clinic.filter((c) => c.date === date),
  };
}

export function render() {
  const key = ui.calMonth;
  const first = parseISO(key + '-01');
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const t = todayISO();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(html`<span class="day out" aria-hidden="true"></span>`);
  for (let d = 1; d <= daysIn; d++) {
    const date = `${key}-${String(d).padStart(2, '0')}`;
    const dd = dayData(date);
    const total = dd.pc.length + dd.adm.length + dd.fu.length + dd.cl.length;
    const cls = [date === t && 'today', date < t && 'past', date === ui.calDay && 'selected'].filter(Boolean).join(' ');
    cells.push(html`<button type="button" class="day ${cls}" data-action="cal-day" data-date="${date}" aria-pressed="${String(date === ui.calDay)}" aria-label="${fmtDate(date, 'long')}, ${plural(total, 'entry', 'entries')}">
      <span class="dn">${d}</span>
      <span class="lines">${MODS.filter((m) => dd[m.k].length).map((m) => html`<span class="ln" style="background:${m.soft};color:${m.color}">${dd[m.k].length}<span> ${m.short}</span></span>`)}</span>
    </button>`);
  }
  return html`
    <div class="toolbar">
      <div class="row">
        <button type="button" class="icon-btn" data-action="cal-month" data-to="${addMonths(key, -1)}" aria-label="Previous month">${icon('chevL')}</button>
        <h2 style="font-size:18px;min-width:160px;text-align:center">${fmtMonth(key)}</h2>
        <button type="button" class="icon-btn" data-action="cal-month" data-to="${addMonths(key, 1)}" aria-label="Next month">${icon('chevR')}</button>
        ${key !== monthKey(t) ? html`<button type="button" class="btn btn-sm" data-action="cal-day" data-date="${t}">Today</button>` : ''}
      </div>
      <span class="spacer"></span>
      <div class="cal-legend" style="padding:0">${MODS.map((m) => html`<span><i style="background:${m.color}"></i>${m.label}</span>`)}</div>
    </div>
    <div class="today-grid">
      <section class="panel"><div class="cal big">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => html`<span class="dow">${d}</span>`)}${cells}</div></section>
      <section class="panel sticky">${daySummary(ui.calDay)}</section>
    </div>`;
}

function daySummary(date) {
  const dd = dayData(date);
  const total = dd.pc.length + dd.adm.length + dd.fu.length + dd.cl.length;
  const block = (label, iconName, rows, route, render) => html`
    <div class="group-h"><span>${icon(iconName, 15)} ${label} · ${rows.length}</span>${rows.length ? html`<a class="btn btn-sm btn-ghost" href="#/${route}">Open</a>` : ''}</div>
    ${rows.length ? html`<ul class="pt-list">${rows.slice(0, 8).map(render)}${rows.length > 8 ? html`<li class="pt muted small" style="grid-template-columns:1fr">+${rows.length - 8} more</li>` : ''}</ul>` : ''}`;
  const line = (name, meta, extra = '') => html`<li class="pt" style="grid-template-columns:minmax(0,1fr) auto;padding:8px 18px"><div style="min-width:0"><div class="nm" style="font-size:13.5px">${name}</div><div class="facts">${meta}</div></div><div>${extra}</div></li>`;
  return html`
    <div class="panel-head">
      <div><h2>${fmtDate(date, 'long')}</h2><p>${relDay(date)} · ${plural(total, 'entry', 'entries')}${isSessionDay(date) ? ' · port session day' : ''}</p></div>
      <button type="button" class="btn btn-sm" data-action="cal-print" ${total ? '' : 'disabled'}>${icon('print', 15)} Print day</button>
    </div>
    ${total ? html`
      ${block('Port cath', 'port', dd.pc, `portcath?day=${date}`, (p) => line(p.name, html`<span class="ltr">${p.fileNumber}</span>${p.weight ? html`<span>${p.weight} kg</span>` : ''}`, p.status === 'done' ? chip('Done', 'green') : ''))}
      ${block('Admissions', 'bed', dd.adm, 'admissions', (a) => line(a.name, html`<span class="ltr">${a.fileNumber}</span><span>${a.admissionDepartment}</span>`, a.triageScore ? chip(`T${a.triageScore}`, { 1: 'red', 2: 'orange', 3: 'amber', 4: 'green', 5: 'blue' }[a.triageScore]) : ''))}
      ${block('Follow-up', 'chat', dd.fu, 'followup', (f) => line(f.name, html`<span class="rtl-text">${f.task}</span>`, fuDone(f) ? chip('Done', 'green') : chip('Open', 'amber')))}
      ${block('Clinic', 'stethoscope', dd.cl, 'clinic', (c) => line(c.name, html`<span>${doctorName(c.primaryPhysician)}</span>`))}`
    : empty('Nothing on this day')}`;
}

function printDay() {
  const date = ui.calDay;
  const dd = dayData(date);
  return printDialog(() => ({
    title: 'Daily Clinical Schedule', subtitle: 'All lists', when: fmtDate(date, 'full'), whenSub: dayName(date), fileDate: date,
    sections: [
      dd.pc.length && { heading: 'Port cath', badge: plural(dd.pc.length, 'patient'), columns: [{ label: 'Name', width: '32%' }, { label: 'File #' }, { label: 'Weight', align: 'c' }, { label: 'Notes' }], rows: dd.pc.map((p) => [p.name, p.fileNumber, p.weight ? p.weight + ' kg' : '', p.notes]) },
      dd.adm.length && { heading: 'Admissions', badge: plural(dd.adm.length, 'patient'), columns: [{ label: 'Name', width: '32%' }, { label: 'File #' }, { label: 'Department' }, { label: 'Triage' }], rows: dd.adm.sort((a, b) => Number(a.triageScore || 9) - Number(b.triageScore || 9)).map((a) => [a.name, a.fileNumber, a.admissionDepartment, a.triageScore ? `${a.triageScore} ${TRIAGE[a.triageScore]?.label || ''}` : '']) },
      dd.fu.length && { heading: 'Follow-up', badge: plural(dd.fu.length, 'patient'), columns: [{ label: 'Name', width: '26%' }, { label: 'Task' }, { label: 'Phone' }, { label: 'Result' }], rows: dd.fu.map((f) => [f.name, f.task, f.phone, f.taskResult]) },
      dd.cl.length && { heading: 'Clinic', badge: plural(dd.cl.length, 'patient'), columns: [{ label: 'Name', width: '30%' }, { label: 'File #' }, { label: 'Doctor' }, { label: 'Note' }], rows: dd.cl.sort((a, b) => byText(a.primaryPhysician, b.primaryPhysician)).map((c) => [c.name, c.fileNumber, doctorName(c.primaryPhysician), c.note]) },
    ].filter(Boolean),
  }), { title: `Print ${fmtDate(date, 'long')}` });
}

registerActions({
  'cal-month': (el) => { ui.calMonth = el.dataset.to; },
  'cal-day': (el) => { ui.calDay = el.dataset.date; ui.calMonth = monthKey(ui.calDay); },
  'cal-print': () => printDay(),
});
