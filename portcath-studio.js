// portcath-studio.js — Port Cath Scheduling Studio

// ── State (global, loaded/saved by app.js) ───────────────────────────────────
let portCathSessionConfig = [];
let portCathActionHistory = [];

let pcStudioYear  = new Date().getFullYear();
let pcStudioMonth = new Date().getMonth();

// ── Arabic month names ────────────────────────────────────────────────────────
const PCS_MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

// ── Date helpers ──────────────────────────────────────────────────────────────
function pcsDateStr(year, month1, day) {
  return `${year}-${String(month1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function pcsDayName(dateStr) {
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

function pcsFormatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${pcsDayName(dateStr)}، ${d.getDate()} ${PCS_MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
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
            <h1>جدولة Port Cath</h1>
            <div class="pcs-subtitle">
              ${PCS_MONTHS_AR[pcStudioMonth]} ${pcStudioYear} —
              ${activeDays} ${activeDays === 1 ? 'يوم جلسة' : 'أيام جلسات'} ·
              ${totalPatients} مريض
            </div>
          </div>
          <div class="pcs-header-actions">
            <button class="pcs-btn" onclick="pcsOpenConfig()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>
              إعداد الأيام
            </button>
            <button class="pcs-btn pcs-btn-primary" onclick="openAddModal('portcath')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              إضافة مريض
            </button>
            <button class="pcs-btn" onclick="pcsPrint()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              طباعة
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
        <h3>لا توجد أيام جلسات هذا الشهر</h3>
        <p>اضغط "إعداد الأيام" لتحديد أيام Port Cath لهذا الشهر</p>
        <button class="pcs-btn pcs-btn-primary" onclick="pcsOpenConfig()">إعداد الأيام</button>
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
    confirmed  > 0 ? `<span class="pcs-chip pcs-chip-green">${confirmed} مؤكد</span>`   : '',
    cancelled  > 0 ? `<span class="pcs-chip pcs-chip-red">${cancelled} ملغي</span>`     : '',
    noshow     > 0 ? `<span class="pcs-chip pcs-chip-yellow">${noshow} لم يحضر</span>`  : '',
    apologized > 0 ? `<span class="pcs-chip pcs-chip-grey">${apologized} اعتذر</span>`  : '',
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
              ? `<span class="pcs-chip pcs-chip-red">يوم ملغي</span>`
              : (chips || `<span class="pcs-chip pcs-chip-grey">لا مرضى</span>`)
            }
          </div>
        </div>
        <div class="pcs-card-toggle">▼</div>
      </div>

      <div class="pcs-patient-list" style="display:none">
        ${patients.length === 0
          ? `<div style="padding:12px 16px;font-size:0.75rem;color:var(--pcs-txt-3)">لا يوجد مرضى في هذا اليوم</div>`
          : patients.map(p => pcsRenderPatientRow(p)).join('')
        }
      </div>

      <div class="pcs-history-toggle" onclick="pcsToggleHistory('${date}')">
        <span>السجل (${historyItems.length} حدث)</span>
        <span>▼</span>
      </div>
      <div class="pcs-history-list" id="pcs-hist-${date}" style="display:none">
        ${historyItems.length === 0
          ? `<div style="font-size:0.7rem;color:var(--pcs-txt-3);padding:4px 0">لا توجد أحداث مسجلة</div>`
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
      <div class="pcs-patient-meta">ملف ${patient.fileNumber}</div>
      <div class="pcs-patient-actions" style="position:relative">
        <button class="pcs-action-btn move" onclick="pcsOpenMoveModal('${patient.id}')">نقل</button>
        <button class="pcs-action-btn cancel" onclick="pcsOpenActionModal('${patient.id}','cancel')">إلغاء</button>
        <button class="pcs-action-btn more" onclick="pcsToggleMoreMenu(event,'${patient.id}')">⋯</button>
        <div class="pcs-more-menu" id="pcs-more-${patient.id}">
          <button class="pcs-more-item" onclick="pcsOpenActionModal('${patient.id}','noshow')">عدم حضور</button>
          <button class="pcs-more-item" onclick="pcsOpenActionModal('${patient.id}','apologize')">اعتذار</button>
          <button class="pcs-more-item" onclick="pcsOpenActionModal('${patient.id}','restore')">استعادة</button>
          <button class="pcs-more-item" onclick="pcsEditPatient('${patient.id}')">تعديل</button>
        </div>
      </div>
    </div>`;
}

function pcsRenderHistoryItem(h) {
  const labels = { move:'نقل', cancel:'إلغاء', noshow:'لم يحضر', apologize:'اعتذار', restore:'استعادة', add:'إضافة', edit:'تعديل' };
  const timeStr = new Date(h.timestamp).toLocaleString('ar-SA', { dateStyle:'short', timeStyle:'short' });
  const desc = h.action === 'move'
    ? `${h.patientName} — من ${h.fromDate} إلى ${h.toDate} · ${h.reason}`
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
function pcsOpenMoveModal(patientId)       { /* implemented in Task 5 */ }
function pcsOpenActionModal(patientId, a)  { /* implemented in Task 6 */ }
function pcsEditPatient(patientId)         { openEditModal('portcath', patientId); }
function pcsPrint()                        { /* implemented in Task 9 */ }

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
    const countLabel = count > 0 ? `${count} م` : '';
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
        <h2 style="font-size:1.3rem;font-weight:800;letter-spacing:-0.025em;color:var(--pcs-txt);margin-bottom:8px;line-height:1.2;">إعداد<br/>الجلسات</h2>
        <p style="font-size:0.75rem;color:var(--pcs-txt-2);line-height:1.6;margin-bottom:24px;">حدد أيام Port Cath لكل شهر. عدد المرضى يظهر في كل يوم تلقائياً.</p>
        <div class="pcs-stat-list">
          <div class="pcs-stat-row">
            <div class="pcs-stat-pip blue"></div>
            <span class="pcs-stat-lbl">أيام نشطة</span>
            <span class="pcs-stat-val">${activeDays}</span>
          </div>
          <div class="pcs-stat-row">
            <div class="pcs-stat-pip red"></div>
            <span class="pcs-stat-lbl">أيام ملغاة</span>
            <span class="pcs-stat-val">${cancelledDays}</span>
          </div>
        </div>
        <div class="pcs-legend">
          <div class="pcs-legend-item"><div class="pcs-ldot a"></div>يوم جلسة نشط</div>
          <div class="pcs-legend-item"><div class="pcs-ldot c"></div>ملغي</div>
          <div class="pcs-legend-item"><div class="pcs-ldot n"></div>غير محدد</div>
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
            <span style="font-size:0.67rem;color:var(--pcs-txt-3)">اضغط يوم لتفعيله أو إلغائه</span>
          </div>
          <div class="pcs-cal-body">
            <div class="pcs-day-hdr-row">
              <div class="pcs-dh">أح</div><div class="pcs-dh">إث</div>
              <div class="pcs-dh">ثل</div><div class="pcs-dh">أر</div>
              <div class="pcs-dh">خم</div><div class="pcs-dh">جم</div>
              <div class="pcs-dh">سب</div>
            </div>
            <div class="pcs-cal-grid">${cells}</div>
            <div class="pcs-cal-hint">
              <b>اضغط</b> على تاريخ فارغ لإضافة يوم جلسة ·
              <b>اضغط</b> على يوم نشط لإلغائه · عدد المرضى يُحدَّث تلقائياً
            </div>
          </div>
          <div class="pcs-cal-footer">
            <button class="pcs-btn" onclick="pcsCloseConfig()">إلغاء</button>
            <button class="pcs-btn pcs-btn-primary" onclick="pcsSaveConfig()">
              حفظ ومزامنة
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
  if (typeof showToast === 'function') showToast('تم حفظ أيام الجلسات ومزامنتها', 'success', 2600);
}
