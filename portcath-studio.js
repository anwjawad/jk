// portcath-studio.js — Port Cath Scheduling Studio

// ── State (global, loaded/saved by app.js) ───────────────────────────────────
let portCathSessionConfig = [];
let portCathActionHistory = [];

let pcStudioYear  = new Date().getFullYear();
let pcStudioMonth = new Date().getMonth();

// ── Month / day names ─────────────────────────────────────────────────────────
const PCS_MONTHS_AR = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Date helpers ──────────────────────────────────────────────────────────────
function pcsDateStr(year, month1, day) {
  return `${year}-${String(month1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function pcsDayName(dateStr) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

function pcsFormatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${pcsDayName(dateStr)}, ${PCS_MONTHS_AR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function pcsPatientsOnDate(dateStr) {
  return portCathList.filter(p => p.date === dateStr);
}

function pcsCountStatus(patients, status) {
  return patients.filter(p => (p.status || 'confirmed') === status).length;
}

function pcsMonthStats() {
  const m1 = pcStudioMonth + 1;
  const prefix = `${pcStudioYear}-${String(m1).padStart(2,'0')}-`;
  const activeDays = portCathSessionConfig.filter(c => c.date.startsWith(prefix) && c.isActive).length;
  const totalPatients = portCathList.filter(p => p.date.startsWith(prefix)).length;
  return { activeDays, totalPatients };
}

// ── Entry point ───────────────────────────────────────────────────────────────
function renderPortCathStudio() {
  const section = document.getElementById('tab-portcath');
  if (!section) return;

  const { activeDays, totalPatients } = pcsMonthStats();

  section.innerHTML = `
    <div class="pcs-root" id="pcs-root">
      <div class="pcs-blob pcs-blob-1"></div>
      <div class="pcs-blob pcs-blob-2"></div>
      <div class="pcs-inner">

        <div class="pcs-header">
          <div class="pcs-header-left">
            <div class="pcs-eyebrow">Port Cath Studio</div>
            <h1>Port Cath Schedule</h1>
            <div class="pcs-subtitle">
              ${PCS_MONTHS_AR[pcStudioMonth]} ${pcStudioYear} —
              ${activeDays} ${activeDays === 1 ? 'session day' : 'session days'} ·
              ${totalPatients} patients
            </div>
          </div>
          <div class="pcs-header-actions">
            <button class="pcs-btn" onclick="pcsOpenConfig()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>
              Configure Days
            </button>
            <button class="pcs-btn pcs-btn-primary" onclick="openAddModal('portcath')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Patient
            </button>
            <button class="pcs-btn" onclick="pcsPrint()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
          </div>
        </div>

        <div class="pcs-month-nav">
          <button class="pcs-nav-btn" onclick="pcsNavigateMonth(-1)">&#8250;</button>
          <span class="pcs-month-label">${PCS_MONTHS_AR[pcStudioMonth]} ${pcStudioYear}</span>
          <button class="pcs-nav-btn" onclick="pcsNavigateMonth(1)">&#8249;</button>
        </div>

        <div id="pcs-cards-container">
          ${pcsRenderDayCards()}
        </div>

      </div>
    </div>
  `;

  // Close more menus when clicking outside
  document.removeEventListener('click', pcsCloseAllMoreMenus);
  document.addEventListener('click', pcsCloseAllMoreMenus);
}

// ── Month navigation ──────────────────────────────────────────────────────────
function pcsNavigateMonth(delta) {
  pcStudioMonth += delta;
  if (pcStudioMonth < 0)  { pcStudioMonth = 11; pcStudioYear--; }
  if (pcStudioMonth > 11) { pcStudioMonth = 0;  pcStudioYear++; }
  renderPortCathStudio();
}

// ── Day cards ─────────────────────────────────────────────────────────────────
function pcsRenderDayCards() {
  const m1 = pcStudioMonth + 1;
  const prefix = `${pcStudioYear}-${String(m1).padStart(2,'0')}-`;

  const sessionDays = portCathSessionConfig
    .filter(c => c.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sessionDays.length === 0) {
    return `
      <div class="pcs-empty">
        <h3>No session days this month</h3>
        <p>Click "Configure Days" to set Port Cath session days for this month.</p>
        <button class="pcs-btn pcs-btn-primary" onclick="pcsOpenConfig()">Configure Days</button>
      </div>`;
  }

  return sessionDays.map(sc => pcsRenderDayCard(sc)).join('');
}

function pcsRenderDayCard(sessionConfig) {
  const { date, isActive } = sessionConfig;
  const patients   = pcsPatientsOnDate(date);
  const confirmed  = pcsCountStatus(patients, 'confirmed');
  const cancelled  = pcsCountStatus(patients, 'cancelled');
  const noshow     = pcsCountStatus(patients, 'noshow');
  const apologized = pcsCountStatus(patients, 'apologized');
  const isCancelled = !isActive;

  const chips = [
    confirmed  > 0 ? `<span class="pcs-chip pcs-chip-green">${confirmed} Confirmed</span>`  : '',
    cancelled  > 0 ? `<span class="pcs-chip pcs-chip-red">${cancelled} Cancelled</span>`   : '',
    noshow     > 0 ? `<span class="pcs-chip pcs-chip-yellow">${noshow} No-Show</span>`     : '',
    apologized > 0 ? `<span class="pcs-chip pcs-chip-grey">${apologized} Apologized</span>`: '',
  ].filter(Boolean).join('');

  const historyItems = portCathActionHistory
    .filter(h => h.fromDate === date || h.toDate === date)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return `
    <div class="pcs-day-card ${isCancelled ? 'pcs-card-cancelled' : ''}" id="pcs-card-${date}">
      <div class="pcs-card-header" onclick="pcsToggleCard('${date}')">
        <div class="pcs-card-count">${isCancelled ? '✕' : patients.length}</div>
        <div class="pcs-card-info">
          <div class="pcs-card-date">${pcsFormatDate(date)}</div>
          <div class="pcs-card-chips">
            ${isCancelled
              ? `<span class="pcs-chip pcs-chip-red">Day Cancelled</span>`
              : (chips || `<span class="pcs-chip pcs-chip-grey">No patients</span>`)
            }
          </div>
        </div>
        <div class="pcs-card-toggle">▼</div>
      </div>

      <div class="pcs-patient-list" style="display:none">
        ${patients.length === 0
          ? `<div style="padding:12px 16px;font-size:0.75rem;color:var(--text-muted)">No patients scheduled for this day.</div>`
          : patients.map(p => pcsRenderPatientRow(p)).join('')
        }
      </div>

      <div class="pcs-history-toggle" onclick="pcsToggleHistory('${date}')">
        <span>History (${historyItems.length} event${historyItems.length === 1 ? '' : 's'})</span>
        <span>▼</span>
      </div>
      <div class="pcs-history-list" id="pcs-hist-${date}" style="display:none">
        ${historyItems.length === 0
          ? `<div style="font-size:0.7rem;color:var(--text-muted);padding:4px 0">No history recorded.</div>`
          : historyItems.map(h => pcsRenderHistoryItem(h)).join('')
        }
      </div>
    </div>`;
}

// Note: innerHTML interpolation of patient.name/fileNumber is consistent with
// the existing app.js pattern throughout this codebase.
function pcsRenderPatientRow(patient) {
  const status = patient.status || 'confirmed';
  const dotSymbol = { confirmed: '✓', cancelled: '✕', noshow: '–', apologized: '~' }[status] || '?';
  return `
    <div class="pcs-patient-row" data-patient-id="${patient.id}">
      <div class="pcs-status-dot ${status}">${dotSymbol}</div>
      <div class="pcs-patient-name">${patient.name}</div>
      <div class="pcs-patient-meta">File # ${patient.fileNumber}</div>
      <div class="pcs-patient-actions" style="position:relative">
        <button class="pcs-action-btn move" onclick="pcsOpenMoveModal('${patient.id}')">Move</button>
        <button class="pcs-action-btn cancel" onclick="pcsOpenActionModal('${patient.id}','cancel')">Cancel</button>
        <button class="pcs-action-btn more" onclick="pcsToggleMoreMenu(event,'${patient.id}')">⋯</button>
        <div class="pcs-more-menu" id="pcs-more-${patient.id}">
          <button class="pcs-more-item" onclick="pcsOpenActionModal('${patient.id}','noshow')">No-Show</button>
          <button class="pcs-more-item" onclick="pcsOpenActionModal('${patient.id}','apologize')">Apologize</button>
          <button class="pcs-more-item" onclick="pcsOpenActionModal('${patient.id}','restore')">Restore</button>
          <button class="pcs-more-item" onclick="pcsEditPatient('${patient.id}')">Edit</button>
        </div>
      </div>
    </div>`;
}

function pcsRenderHistoryItem(h) {
  const labels = { move:'Move', cancel:'Cancel', noshow:'No-Show', apologize:'Apologize', restore:'Restore', add:'Add', edit:'Edit' };
  const timeStr = new Date(h.timestamp).toLocaleString('en-US', { dateStyle:'short', timeStyle:'short' });
  const desc = h.action === 'move'
    ? `${h.patientName} — from ${h.fromDate} to ${h.toDate} · ${h.reason}`
    : `${h.patientName} · ${h.reason || ''}`;
  return `
    <div class="pcs-history-item">
      <span class="pcs-history-action">${labels[h.action] || h.action}</span>
      <span class="pcs-history-desc">${desc}</span>
      <span class="pcs-history-time">${timeStr}</span>
    </div>`;
}

// ── Toggle helpers ────────────────────────────────────────────────────────────
function pcsToggleCard(date) {
  const card = document.getElementById(`pcs-card-${date}`);
  if (!card) return;
  card.classList.toggle('open');
  const list = card.querySelector('.pcs-patient-list');
  if (list) list.style.display = card.classList.contains('open') ? 'block' : 'none';
}

function pcsToggleHistory(date) {
  const hist = document.getElementById(`pcs-hist-${date}`);
  if (hist) hist.style.display = hist.style.display === 'none' ? 'block' : 'none';
}

function pcsToggleMoreMenu(e, patientId) {
  e.stopPropagation();
  document.querySelectorAll('.pcs-more-menu.active').forEach(m => {
    if (m.id !== `pcs-more-${patientId}`) m.classList.remove('active');
  });
  const menu = document.getElementById(`pcs-more-${patientId}`);
  if (menu) menu.classList.toggle('active');
}

function pcsCloseAllMoreMenus() {
  document.querySelectorAll('.pcs-more-menu.active').forEach(m => m.classList.remove('active'));
}

// ── Stubs for handlers defined in later tasks ─────────────────────────────────
// pcsOpenConfig defined below in Session Config section
function pcsOpenMoveModal(patientId)       { _pcsMoveOpen(patientId); }
function pcsOpenActionModal(patientId, action) { _pcsActionOpen(patientId, action); }
function pcsEditPatient(patientId)         { openEditModal('portcath', patientId); }
function pcsPrint() {
  const STATUS_EN = { confirmed:'Confirmed', cancelled:'Cancelled', noshow:'No-Show', apologized:'Apologized', restore:'Restored' };

  const activeDays = portCathSessionConfig.filter(c =>
    c.isActive && Number(c.year) === pcStudioYear && Number(c.month) === pcStudioMonth
  ).sort((a, b) => a.date.localeCompare(b.date));

  let rows = '';
  activeDays.forEach(sc => {
    const patients = pcsPatientsOnDate(sc.date);
    const patientRows = patients.length
      ? patients.map((p, i) =>
          `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.fileNumber}</td><td>${STATUS_EN[p.status] || p.status || ''}</td></tr>`
        ).join('')
      : `<tr><td colspan="4" style="color:#888;text-align:center">No patients</td></tr>`;
    rows += `
      <div class="day-block">
        <h3>${pcsFormatDate(sc.date)}</h3>
        <table><thead><tr><th>#</th><th>Patient</th><th>File #</th><th>Status</th></tr></thead>
        <tbody>${patientRows}</tbody></table>
      </div>`;
  });

  if (!rows) rows = '<p style="text-align:center;color:#888">No sessions scheduled this month.</p>';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Port Cath — ${PCS_MONTHS_AR[pcStudioMonth]} ${pcStudioYear}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; }
      h2 { text-align: center; margin-bottom: 16px; }
      .day-block { margin-bottom: 24px; page-break-inside: avoid; }
      h3 { font-size: 14px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
      th { background: #f0f0f0; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h2>Port Cath Schedule — ${PCS_MONTHS_AR[pcStudioMonth]} ${pcStudioYear}</h2>
    ${rows}
  </body></html>`;

  const printWin = window.open('', '_blank', 'width=800,height=600');
  if (!printWin) { alert('Please allow pop-ups to print the schedule.'); return; }
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  printWin.print();
}

// ── Session Config ────────────────────────────────────────────────────────────
let _pcsConfigYear  = new Date().getFullYear();
let _pcsConfigMonth = new Date().getMonth();

function pcsOpenConfig() {
  _pcsConfigYear  = pcStudioYear;
  _pcsConfigMonth = pcStudioMonth;
  const overlay = document.getElementById('pcs-config-overlay');
  if (overlay) overlay.classList.add('active');
  pcsRenderConfigCalendar();
}

function pcsCloseConfig() {
  const overlay = document.getElementById('pcs-config-overlay');
  if (overlay) overlay.classList.remove('active');
}

function pcsConfigNavigateMonth(delta) {
  _pcsConfigMonth += delta;
  if (_pcsConfigMonth < 0)  { _pcsConfigMonth = 11; _pcsConfigYear--; }
  if (_pcsConfigMonth > 11) { _pcsConfigMonth = 0;  _pcsConfigYear++; }
  pcsRenderConfigCalendar();
}

function pcsRenderConfigCalendar() {
  const inner = document.getElementById('pcs-config-inner');
  if (!inner) return;

  const year  = _pcsConfigYear;
  const month = _pcsConfigMonth;
  const m1    = month + 1;
  const prefix = `${year}-${String(m1).padStart(2,'0')}-`;

  const activeDays    = portCathSessionConfig.filter(c => c.date.startsWith(prefix) && c.isActive).length;
  const cancelledDays = portCathSessionConfig.filter(c => c.date.startsWith(prefix) && !c.isActive).length;

  const firstDOW    = new Date(`${year}-${String(m1).padStart(2,'0')}-01`).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let cells = '';
  for (let i = 0; i < firstDOW; i++) {
    cells += `<div class="pcs-cal-day empty"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = pcsDateStr(year, m1, d);
    const conf = portCathSessionConfig.find(c => c.date === dateStr);
    let cls = 'inactive';
    if (conf) cls = conf.isActive ? 'active' : 'cancelled-day';
    const count = pcsPatientsOnDate(dateStr).length;
    const countLabel = count > 0 ? `${count}` : '';
    const delay = (firstDOW + d - 1) * 16;
    cells += `
      <div class="pcs-cal-day ${cls}" data-date="${dateStr}"
           style="animation-delay:${delay}ms"
           onclick="pcsToggleDay('${dateStr}')">
        <span class="pcs-dn">${d}</span>
        <span class="pcs-dc">${countLabel}</span>
      </div>`;
  }

  inner.innerHTML = `
    <div class="pcs-config-shell">
      <aside class="pcs-config-rail">
        <div class="pcs-eyebrow" style="font-size:0.6rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--pcs-blue);margin-bottom:10px;">Port Cath Studio</div>
        <h2 style="font-size:1.3rem;font-weight:800;letter-spacing:-0.025em;color:var(--text-main);margin-bottom:8px;line-height:1.2;">Configure<br/>Sessions</h2>
        <p style="font-size:0.75rem;color:var(--text-muted);line-height:1.6;margin-bottom:24px;">Select Port Cath session days for each month. Patient counts update automatically.</p>
        <div class="pcs-stat-list">
          <div class="pcs-stat-row">
            <div class="pcs-stat-pip blue"></div>
            <span class="pcs-stat-lbl">Active days</span>
            <span class="pcs-stat-val">${activeDays}</span>
          </div>
          <div class="pcs-stat-row">
            <div class="pcs-stat-pip red"></div>
            <span class="pcs-stat-lbl">Cancelled days</span>
            <span class="pcs-stat-val">${cancelledDays}</span>
          </div>
        </div>
        <div class="pcs-legend">
          <div class="pcs-legend-item"><div class="pcs-ldot a"></div>Active session</div>
          <div class="pcs-legend-item"><div class="pcs-ldot c"></div>Cancelled</div>
          <div class="pcs-legend-item"><div class="pcs-ldot n"></div>Unset</div>
        </div>
      </aside>
      <main>
        <div class="pcs-cal-card">
          <div class="pcs-cal-topbar">
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="pcs-nav-btn" onclick="pcsConfigNavigateMonth(-1)">&#8250;</button>
              <span class="pcs-month-label">${PCS_MONTHS_AR[month]} ${year}</span>
              <button class="pcs-nav-btn" onclick="pcsConfigNavigateMonth(1)">&#8249;</button>
            </div>
            <span style="font-size:0.67rem;color:var(--text-muted)">Click a day to toggle it</span>
          </div>
          <div class="pcs-cal-body">
            <div class="pcs-day-hdr-row">
              <div class="pcs-dh">Sun</div><div class="pcs-dh">Mon</div>
              <div class="pcs-dh">Tue</div><div class="pcs-dh">Wed</div>
              <div class="pcs-dh">Thu</div><div class="pcs-dh">Fri</div>
              <div class="pcs-dh">Sat</div>
            </div>
            <div class="pcs-cal-grid">${cells}</div>
            <div class="pcs-cal-hint">
              <b>Click</b> an empty date to add a session day ·
              <b>Click</b> an active day to cancel it · Patient counts update automatically
            </div>
          </div>
          <div class="pcs-cal-footer">
            <button class="pcs-btn" onclick="pcsCloseConfig()">Cancel</button>
            <button class="pcs-btn pcs-btn-primary" onclick="pcsSaveConfig()">
              Save &amp; Sync
            </button>
          </div>
        </div>
      </main>
    </div>`;
}

function pcsToggleDay(dateStr) {
  const existing = portCathSessionConfig.find(c => c.date === dateStr);
  if (!existing) {
    portCathSessionConfig.push({
      id: Date.now().toString(),
      date: dateStr,
      isActive: true,
      createdAt: new Date().toISOString(),
      _isNew: true
    });
  } else if (existing.isActive) {
    existing.isActive = false;
  } else {
    existing.isActive = true;
  }
  pcsRenderConfigCalendar();
}

function pcsSaveConfig() {
  saveToLocalStorage();
  portCathSessionConfig.forEach(c => {
    const action = c._isNew ? 'create' : 'update';
    syncAfterChange(action, 'portcath-session-config', c);
    delete c._isNew;
  });
  pcsCloseConfig();
  renderPortCathStudio();
  if (typeof showToast === 'function') showToast('Session days saved and synced.', 'success', 2600);
}

// ── Move Workflow ─────────────────────────────────────────────────────────────
let _pcsMovePatientId = null;

function _pcsMoveOpen(patientId) {
  const patient = portCathList.find(p => p.id === patientId);
  if (!patient) return;
  _pcsMovePatientId = patientId;

  document.getElementById('pcs-move-patient-info').textContent =
    `${patient.name} · File # ${patient.fileNumber}`;

  const today  = new Date().toISOString().split('T')[0];
  const select = document.getElementById('pcs-move-date-select');
  select.innerHTML = `<option value="">Select session day</option>`;
  portCathSessionConfig
    .filter(c => c.isActive && c.date !== patient.date && c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.date;
      opt.textContent = pcsFormatDate(c.date);
      select.appendChild(opt);
    });

  document.getElementById('pcs-move-reason').value = '';
  document.getElementById('pcs-move-reason-err').classList.remove('visible');
  document.getElementById('pcs-move-overlay').classList.add('active');
}

function pcsCloseMoveModal() {
  document.getElementById('pcs-move-overlay').classList.remove('active');
  _pcsMovePatientId = null;
}

function pcsConfirmMove() {
  const patient = portCathList.find(p => p.id === _pcsMovePatientId);
  if (!patient) return;

  const toDate = document.getElementById('pcs-move-date-select').value;
  const reason = document.getElementById('pcs-move-reason').value.trim();

  const errEl = document.getElementById('pcs-move-reason-err');
  if (reason.length < 3) { errEl.classList.add('visible'); return; }
  errEl.classList.remove('visible');
  if (!toDate) { if (typeof showToast === 'function') showToast('Please select a destination date.', 'warning', 3000); return; }

  const fromDate = patient.date;

  // 1. Update patient record
  patient.date = toDate;
  patient.day  = pcsDayName(toDate);

  // 2. Append history record
  const histRecord = {
    id:          Date.now().toString() + '_move',
    patientId:   patient.id,
    patientName: patient.name,
    fileNumber:  patient.fileNumber,
    action:      'move',
    fromDate,
    toDate,
    reason,
    note:        '',
    timestamp:   Date.now(),
    syncStatus:  'pending'
  };
  portCathActionHistory.push(histRecord);

  // 3. Persist and sync
  saveToLocalStorage();
  syncAfterChange('update', 'portcath', patient);
  syncAfterChange('create', 'portcath-history', histRecord);

  pcsCloseMoveModal();
  renderPortCathStudio();
  if (typeof showToast === 'function')
    showToast(`${patient.name} moved to ${pcsFormatDate(toDate)}`, 'success', 3000);
}

// ── Status Actions (cancel / noshow / apologize / restore) ────────────────────
const PCS_ACTION_LABELS = {
  cancel:    { title: 'Cancel Appointment', newStatus: 'cancelled'  },
  noshow:    { title: 'Record No-Show',     newStatus: 'noshow'     },
  apologize: { title: 'Record Apology',     newStatus: 'apologized' },
  restore:   { title: 'Restore Appointment',newStatus: 'confirmed'  }
};

let _pcsActionPatientId = null;
let _pcsActionType      = null;

function _pcsActionOpen(patientId, action) {
  const patient = portCathList.find(p => p.id === patientId);
  if (!patient || !PCS_ACTION_LABELS[action]) return;
  pcsCloseAllMoreMenus();
  _pcsActionPatientId = patientId;
  _pcsActionType      = action;

  document.getElementById('pcs-action-title').textContent = PCS_ACTION_LABELS[action].title;
  document.getElementById('pcs-action-patient-info').textContent =
    `${patient.name} · File # ${patient.fileNumber} · ${pcsFormatDate(patient.date)}`;
  document.getElementById('pcs-action-reason').value = '';
  document.getElementById('pcs-action-reason-err').classList.remove('visible');
  document.getElementById('pcs-action-overlay').classList.add('active');
}

function pcsCloseActionModal() {
  document.getElementById('pcs-action-overlay').classList.remove('active');
  _pcsActionPatientId = null;
  _pcsActionType      = null;
}

function pcsConfirmAction() {
  const patient = portCathList.find(p => p.id === _pcsActionPatientId);
  if (!patient || !_pcsActionType) return;

  const reason = document.getElementById('pcs-action-reason').value.trim();
  const errEl  = document.getElementById('pcs-action-reason-err');
  if (reason.length < 3) { errEl.classList.add('visible'); return; }
  errEl.classList.remove('visible');

  const { newStatus } = PCS_ACTION_LABELS[_pcsActionType];

  // 1. Update patient status
  patient.status = newStatus;

  // 2. History record
  const histRecord = {
    id:          Date.now().toString() + '_' + _pcsActionType,
    patientId:   patient.id,
    patientName: patient.name,
    fileNumber:  patient.fileNumber,
    action:      _pcsActionType,
    fromDate:    patient.date,
    toDate:      null, // null for non-move actions; fromDate = session date acted on
    reason,
    note:        '',
    timestamp:   Date.now(),
    syncStatus:  'pending'
  };
  portCathActionHistory.push(histRecord);

  // 3. Persist and sync
  saveToLocalStorage();
  syncAfterChange('update', 'portcath', patient);
  syncAfterChange('create', 'portcath-history', histRecord);

  pcsCloseActionModal();
  renderPortCathStudio();
  if (typeof showToast === 'function')
    showToast(`Status updated for ${patient.name}`, 'success', 2600);
}
