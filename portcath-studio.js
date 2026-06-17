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
function pcsOpenConfig()                   { /* implemented in Task 4 */ }
function pcsOpenMoveModal(patientId)       { /* implemented in Task 5 */ }
function pcsOpenActionModal(patientId, a)  { /* implemented in Task 6 */ }
function pcsEditPatient(patientId)         { openEditModal('portcath', patientId); }
function pcsPrint()                        { /* implemented in Task 9 */ }
