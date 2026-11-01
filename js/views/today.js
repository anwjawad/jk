// Today: what needs doing now, across every list.
import { html, todayISO, fmtDate, relDay, plural, byText } from '../util.js';
import { lists, patientsOn, upcomingSessions, isBooked, TRIAGE, fuDone, openTasks, doctorName, doctorColor } from '../model.js';
import { icon, chip, empty, telLinks } from '../ui.js';
import { settings } from '../settings.js';

export const title = () => 'Today';
export const sub = () => fmtDate(todayISO(), 'long');

export function render() {
  const L = lists();
  const t = L.today;
  const name = settings.get('userName');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const pcToday = patientsOn(t).filter((p) => p.status !== 'cancelled');
  const nextSession = upcomingSessions(t, 2).find((d) => d > t) || '';
  const nextPts = nextSession ? patientsOn(nextSession).filter((p) => p.status !== 'cancelled') : [];
  const adm = L.admissions.filter((a) => a.date === t).sort((a, b) => Number(a.triageScore || 9) - Number(b.triageScore || 9) || byText(a.name, b.name));
  const fu = L.followup.filter((f) => f.date === t);
  const fuOpen = fu.filter((f) => !fuDone(f));
  const fuOverdue = L.followup.filter((f) => f.date && f.date < t && !fuDone(f));
  const cl = L.clinic.filter((c) => c.date === t);
  const tasks = L.tumorboard.reduce((n, p) => n + openTasks(p).length, 0);

  return html`
    <div class="page-head">
      <div><h2>${greet}${name ? `, ${name}` : ''}</h2><p>${fmtDate(t, 'long')}</p></div>
      <div class="row">
        <a class="btn" href="#/calendar">${icon('calendar', 17)} Calendar</a>
        <a class="btn btn-primary" href="#/portcath">${icon('port', 17)} Port cath</a>
      </div>
    </div>

    <div class="kpis">
      <a class="kpi" href="#/portcath?day=${t}"><span class="k-label">${icon('port', 15)} Port cath today</span><b>${pcToday.length}</b><small>${pcToday.filter((p) => p.status === 'done').length} done</small></a>
      <a class="kpi ${L.awaiting.length ? 'alert' : ''}" href="#/portcath?tab=awaiting"><span class="k-label">${icon('alert', 15)} Awaiting outcome</span><b>${L.awaiting.length}</b><small>${L.awaiting.length ? 'past bookings to confirm' : 'all confirmed'}</small></a>
      <a class="kpi" href="#/portcath?tab=waiting"><span class="k-label">${icon('users', 15)} Port waiting list</span><b>${L.waiting.length}</b><small>no date yet</small></a>
      <a class="kpi" href="#/admissions"><span class="k-label">${icon('bed', 15)} Admissions today</span><b>${adm.length}</b><small>${adm.filter((a) => Number(a.triageScore) <= 2).length} triage 1–2</small></a>
      <a class="kpi ${fuOverdue.length ? 'alert' : ''}" href="#/followup"><span class="k-label">${icon('chat', 15)} Calls &amp; WhatsApp</span><b>${fuOpen.length}</b><small>${fuOverdue.length ? `${fuOverdue.length} overdue from earlier` : `of ${fu.length} today still open`}</small></a>
      <a class="kpi" href="#/clinic"><span class="k-label">${icon('stethoscope', 15)} Clinic today</span><b>${cl.length}</b><small>${plural(new Set(cl.map((c) => doctorName(c.primaryPhysician))).size, 'doctor')}</small></a>
      <a class="kpi" href="#/tumorboard"><span class="k-label">${icon('board', 15)} Tumor board tasks</span><b>${tasks}</b><small>open across ${plural(L.tumorboard.filter((p) => openTasks(p).length).length, 'patient')}</small></a>
    </div>

    <div class="today-grid">
      <div class="stack" style="gap:18px">
        ${L.awaiting.length ? html`
          <section class="panel">
            <div class="panel-head"><div><h2>${icon('alert', 18)} Did these patients get their port?</h2><p>Bookings from past sessions without an outcome.</p></div><a class="btn btn-sm" href="#/portcath?tab=awaiting">Open all</a></div>
            <ul class="pt-list">${L.awaiting.slice(0, 6).map((p) => miniPc(p, true))}</ul>
            ${L.awaiting.length > 6 ? html`<div class="panel-foot"><a class="btn btn-sm btn-ghost" href="#/portcath?tab=awaiting">and ${L.awaiting.length - 6} more…</a></div>` : ''}
          </section>` : ''}

        <section class="panel">
          <div class="panel-head"><div><h2>${icon('port', 18)} Port cath session · today</h2><p>${pcToday.length ? plural(pcToday.length, 'patient') : 'No patients booked today'}</p></div><a class="btn btn-sm" href="#/portcath?day=${t}">Open day</a></div>
          ${pcToday.length ? html`<ul class="pt-list">${pcToday.map((p) => miniPc(p, false))}</ul>`
            : empty('No session today', nextSession ? `Next session ${fmtDate(nextSession, 'long')} (${relDay(nextSession)}) with ${plural(nextPts.length, 'patient')}.` : 'No upcoming session days are set.', nextSession ? html`<a class="btn btn-sm" href="#/portcath?day=${nextSession}">Open next session</a>` : '')}
        </section>

        <section class="panel">
          <div class="panel-head"><div><h2>${icon('bed', 18)} Planned admissions · today</h2><p>Most urgent first.</p></div><a class="btn btn-sm" href="#/admissions">Open admissions</a></div>
          ${adm.length ? html`<ul class="pt-list">${adm.map((a) => html`
            <li class="pt"><span class="av" style="background:var(--${toneVar(a.triageScore)}-soft);color:var(--${toneVar(a.triageScore)})">${a.triageScore || '–'}</span>
              <div style="min-width:0"><div class="nm"><a href="#/admissions?focus=${a.id}" style="color:inherit;text-decoration:none">${a.name}</a></div>
                <div class="facts"><span>File <b class="ltr">${a.fileNumber}</b></span><span>${a.admissionDepartment}</span><span>${a.primaryPhysician}</span></div></div>
              <div class="acts">${chip(TRIAGE[a.triageScore]?.label || 'No triage', toneVar(a.triageScore))}</div></li>`)}</ul>`
            : empty('No admissions planned for today')}
        </section>
      </div>

      <div class="stack" style="gap:18px">
        <section class="panel">
          <div class="panel-head"><div><h2>${icon('chat', 18)} Calls &amp; WhatsApp</h2><p>${fu.length ? `${fuOpen.length} of ${fu.length} still to do` : 'Nothing planned today'}</p></div><a class="btn btn-sm" href="#/followup">Open list</a></div>
          ${[...fuOverdue, ...fuOpen].length ? html`<ul class="pt-list">${[...fuOverdue, ...fuOpen].slice(0, 8).map((f) => html`
            <li class="pt" style="grid-template-columns:minmax(0,1fr) auto"><div style="min-width:0"><div class="nm"><a href="#/followup?focus=${f.id}" style="color:inherit;text-decoration:none">${f.name}</a>${f.date < t ? chip(`Overdue · ${fmtDate(f.date)}`, 'orange') : ''}</div>
              <div class="facts"><span class="rtl-text">${f.task}</span></div></div><div class="acts">${telLinks(f.phone)}</div></li>`)}</ul>`
            : empty(fu.length ? 'All calls done for today' : 'No calls today')}
        </section>

        <section class="panel">
          <div class="panel-head"><div><h2>${icon('stethoscope', 18)} Clinic appointments · today</h2></div><a class="btn btn-sm" href="#/clinic">Open clinic</a></div>
          ${cl.length ? html`<ul class="pt-list">${groupDocs(cl).map(([doc, rows]) => html`
            <li class="pt" style="grid-template-columns:auto minmax(0,1fr) auto"><span class="av" style="background:${doctorColor(doc)};color:#fff">${rows.length}</span>
              <div><div class="nm">${doc}</div><div class="facts">${rows.slice(0, 3).map((r) => html`<span>${r.name}</span>`)}${rows.length > 3 ? html`<span>+${rows.length - 3}</span>` : ''}</div></div><span></span></li>`)}</ul>`
            : empty('No clinic appointments today')}
        </section>

        ${nextSession && pcToday.length ? html`
          <section class="panel">
            <div class="panel-head"><div><h2>${icon('calendar', 18)} Next port session</h2><p>${fmtDate(nextSession, 'long')} · ${relDay(nextSession)}</p></div><a class="btn btn-sm" href="#/portcath?day=${nextSession}">Open</a></div>
            <div class="panel-body"><b style="font-size:24px">${nextPts.length}</b> <span class="muted">booked</span></div>
          </section>` : ''}
      </div>
    </div>`;
}

const toneVar = (s) => ({ 1: 'red', 2: 'orange', 3: 'amber', 4: 'green', 5: 'blue' }[s] || 'grey');

function groupDocs(rows) {
  const m = new Map();
  for (const r of rows) { const k = doctorName(r.primaryPhysician); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m].sort((a, b) => byText(a[0], b[0]));
}

function miniPc(p, showDate) {
  const past = p.date <= todayISO();
  return html`
    <li class="pt" data-status="${p.status === 'scheduled' ? 'confirmed' : p.status}">
      <span class="av" aria-hidden="true">${p.status === 'done' ? icon('check', 17) : (p.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
      <div style="min-width:0"><div class="nm"><a href="#/portcath?focus=${p.id}" style="color:inherit;text-decoration:none">${p.name}</a>${showDate ? html`<span class="muted small">${fmtDate(p.date, 'med')} · ${relDay(p.date)}</span>` : ''}</div>
        <div class="facts"><span>File <b class="ltr">${p.fileNumber}</b></span>${p.weight ? html`<span><b>${p.weight}</b> kg</span>` : ''}${p.phone ? telLinks(p.phone) : ''}</div></div>
      <div class="acts">
        ${isBooked(p) && past ? html`
          <button type="button" class="btn btn-sm btn-done" data-action="pc-done" data-id="${p.id}">${icon('check', 15)} Port done</button>
          <button type="button" class="btn btn-sm btn-notdone" data-action="pc-notdone" data-id="${p.id}">${icon('x', 15)} Not done</button>`
        : p.status === 'done' ? html`<span class="outcome ok">${icon('checkCircle', 16)} Port done</span>` : chip('Booked', 'blue')}
      </div>
    </li>`;
}
