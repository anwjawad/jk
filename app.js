// App State
let portCathList = [];
let admissionsList = [];
let followUpList = [];
let tumorBoardList = [];
let currentEditType = null; // 'portcath', 'admissions', 'followup', or 'tumorboard'
let currentEditId = null;

// Excel Import Temporary State
let excelImportedFiles = [];

// Load lists on init
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    updateDashboardDate();
    renderDashboard();
    renderPortCathTable();
    renderAdmissionsTable();
    renderFollowUpTable();
    renderTumorBoardTable();
    
    // Set default dates to today's date in input fields
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('pc-date').value = today;
    document.getElementById('adm-date').value = today;
    document.getElementById('f-date').value = today;
    if (document.getElementById('prof-task-clinic-date')) {
        document.getElementById('prof-task-clinic-date').value = today;
    }

    // Excel Drag & Drop setup
    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                parseExcelFiles(files);
            }
        });
    }
});

// Switch Tabs
function switchTab(tabId) {
    // Update active tab class
    document.querySelectorAll('.tab-view').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Update sidebar menu active state
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.classList.remove('active');
    });
    
    // Find matching menu item
    let menuItemId = `menu-${tabId}`;
    if (tabId === 'dashboard') menuItemId = 'menu-dashboard';
    const activeItem = document.getElementById(menuItemId);
    if (activeItem) activeItem.classList.add('active');

    // Perform specific tab initialization
    if (tabId === 'dashboard') {
        renderDashboard();
    } else if (tabId === 'followup') {
        renderFollowUpTable();
    } else if (tabId === 'tumorboard') {
        renderTumorBoardTable();
    }

    // Toggle FAB visibility based on active tab
    const fab = document.getElementById('global-fab');
    if (fab) {
        if (['portcath', 'admissions', 'followup', 'tumorboard'].includes(tabId)) {
            fab.style.display = 'flex';
        } else {
            fab.style.display = 'none';
        }
    }
}

// Modal opening/closing and FAB handlers
function openAddModal(type) {
    const modal = document.getElementById(`modal-add-${type}`);
    if (modal) {
        modal.classList.add('active');
        // Set date field to today if empty
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById(type === 'portcath' ? 'pc-date' : (type === 'admissions' ? 'adm-date' : 'f-date'));
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
        }
    }
}

function closeAddModal(type) {
    const modal = document.getElementById(`modal-add-${type}`);
    if (modal) {
        modal.classList.remove('active');
    }
}

function openAddModalForCurrentTab() {
    const activeTab = document.querySelector('.tab-view.active');
    if (!activeTab) return;
    const tabId = activeTab.id.replace('tab-', '');
    if (['portcath', 'admissions', 'followup', 'tumorboard'].includes(tabId)) {
        openAddModal(tabId);
    }
}


// Dark Mode Toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('medsched_dark_mode', isDark);
}

// Dynamic Date Dropdowns population
function updateDateDropdown(type) {
    const select = document.getElementById(`filter-date-${type}`);
    if (!select) return;
    
    const selectedValue = select.value || 'all';
    
    let list = [];
    if (type === 'portcath') list = portCathList;
    else if (type === 'admissions') list = admissionsList;
    else if (type === 'followup') list = followUpList;
    
    // Extract unique dates
    const dates = [...new Set(list.map(p => p.date).filter(d => !!d))];
    dates.sort((a, b) => new Date(a) - new Date(b));
    
    let html = `<option value="all">All Dates</option>`;
    dates.forEach(d => {
        html += `<option value="${d}">${formatDateDisplay(d)}</option>`;
    });
    
    select.innerHTML = html;
    
    // Restore selected value if still present, otherwise default to 'all'
    const hasSelectedValue = dates.some(d => d === selectedValue);
    if (selectedValue !== 'all' && hasSelectedValue) {
        select.value = selectedValue;
    } else {
        select.value = 'all';
    }
}

// Persist and Fetch
function saveToLocalStorage() {
    localStorage.setItem('medsched_portcath', JSON.stringify(portCathList));
    localStorage.setItem('medsched_admissions', JSON.stringify(admissionsList));
    localStorage.setItem('medsched_followup', JSON.stringify(followUpList));
    localStorage.setItem('medsched_tumorboard', JSON.stringify(tumorBoardList));
}

function loadFromLocalStorage() {
    const pcData = localStorage.getItem('medsched_portcath');
    const admData = localStorage.getItem('medsched_admissions');
    const fuData = localStorage.getItem('medsched_followup');
    const tbData = localStorage.getItem('medsched_tumorboard');
    const isDark = localStorage.getItem('medsched_dark_mode');

    if (pcData) portCathList = JSON.parse(pcData);
    if (admData) admissionsList = JSON.parse(admData);
    if (fuData) followUpList = JSON.parse(fuData);
    if (tbData) tumorBoardList = JSON.parse(tbData);
    if (isDark === 'true') document.body.classList.add('dark-mode');
    
    // Update date filters
    updateDateDropdown('portcath');
    updateDateDropdown('admissions');
    updateDateDropdown('followup');
}

// Clear lists completely
function clearList(type) {
    const listName = type === 'portcath' ? 'Port Cath' : (type === 'admissions' ? 'Admissions' : (type === 'followup' ? 'Follow-up' : 'Tumor Board'));
    if (confirm(`Are you sure you want to clear the entire ${listName} list? This action cannot be undone.`)) {
        if (type === 'portcath') {
            portCathList = [];
            renderPortCathTable();
            updateDateDropdown(type);
        } else if (type === 'admissions') {
            admissionsList = [];
            renderAdmissionsTable();
            updateDateDropdown(type);
        } else if (type === 'followup') {
            followUpList = [];
            renderFollowUpTable();
            updateDateDropdown(type);
        } else if (type === 'tumorboard') {
            tumorBoardList = [];
            renderTumorBoardTable();
        }
        saveToLocalStorage();
        renderDashboard();
    }
}

// Helper Date functions
function getDayName(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function updateDashboardDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    document.getElementById('dashboard-date').innerText = "Today is " + today.toLocaleDateString('en-US', options);
}

function formatDateDisplay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// PORT CATH LOGIC
function addPortCathPatient(event) {
    event.preventDefault();
    const name = document.getElementById('pc-name').value.trim();
    const fileNumber = document.getElementById('pc-file').value.trim();
    const date = document.getElementById('pc-date').value;
    const weight = parseFloat(document.getElementById('pc-weight').value);
    const notes = document.getElementById('pc-notes').value.trim();

    const patient = {
        id: Date.now().toString(),
        name,
        fileNumber,
        date,
        day: getDayName(date),
        weight,
        notes
    };

    portCathList.push(patient);
    saveToLocalStorage();
    updateDateDropdown('portcath');
    renderPortCathTable();
    renderDashboard();

    // Reset Form
    document.getElementById('form-portcath').reset();
    document.getElementById('pc-date').value = new Date().toISOString().split('T')[0];

    // Close the Modal
    closeAddModal('portcath');
}

function renderPortCathTable() {
    const tbody = document.querySelector('#table-portcath tbody');
    tbody.innerHTML = '';
    
    const filterDate = document.getElementById('filter-date-portcath')?.value || 'all';
    let filteredList = [...portCathList];
    if (filterDate !== 'all') {
        filteredList = filteredList.filter(p => p.date === filterDate);
    }
    
    document.getElementById('counter-portcath').innerText = filteredList.length;

    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
                        <h3>No patients found</h3>
                        <p>${portCathList.length === 0 ? "Use the form on the left or Excel import to add patients." : "No patients scheduled for this date."}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Sort by Date ascending
    const sortedList = filteredList.sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedList.forEach(patient => {
        const tr = document.createElement('tr');
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('.no-print')) {
                return;
            }
            openEditPatient('portcath', patient.id);
        });
        tr.innerHTML = `
            <td style="font-weight: 600;">${patient.name}</td>
            <td><code>${patient.fileNumber}</code></td>
            <td>${formatDateDisplay(patient.date)}</td>
            <td><span class="badge badge-info">${patient.day}</span></td>
            <td><strong>${patient.weight} kg</strong></td>
            <td style="color: var(--text-muted); font-size: 0.85rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${patient.notes || ''}">
                ${patient.notes || '<span style="color:var(--text-light)">-</span>'}
            </td>
            <td class="no-print">
                <div class="table-actions">
                    <button class="action-btn edit" onclick="openEditPatient('portcath', '${patient.id}')" title="Edit Patient">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-btn delete" onclick="deletePatient('portcath', '${patient.id}')" title="Delete Patient">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterPortCathTable() {
    const query = document.getElementById('search-portcath').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#table-portcath tbody tr');
    
    rows.forEach(row => {
        // Skip if empty state row
        if (row.querySelector('.empty-state')) return;
        
        const nameText = row.cells[0].innerText.toLowerCase();
        const fileText = row.cells[1].innerText.toLowerCase();
        const notesText = row.cells[5].innerText.toLowerCase();
        
        if (nameText.includes(query) || fileText.includes(query) || notesText.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}


// ADMISSIONS LOGIC
function addAdmissionPatient(event) {
    event.preventDefault();
    const name = document.getElementById('adm-name').value.trim();
    const fileNumber = document.getElementById('adm-file').value.trim();
    const age = parseInt(document.getElementById('adm-age').value);
    const triageScore = document.getElementById('adm-triage').value;
    const primaryPhysician = document.getElementById('adm-physician').value.trim();
    const placeOfReferral = document.getElementById('adm-referral').value;
    const modeOfTransportation = document.getElementById('adm-transport').value;
    const performanceStatus = document.getElementById('adm-performance').value;
    const admissionDepartment = document.getElementById('adm-department').value.trim();
    const date = document.getElementById('adm-date').value;
    const summary = document.getElementById('adm-summary').value.trim();
    const causeOfAdmission = document.getElementById('adm-cause').value.trim();
    const notes = document.getElementById('adm-notes').value.trim();

    const patient = {
        id: Date.now().toString(),
        name,
        fileNumber,
        age,
        triageScore,
        primaryPhysician,
        placeOfReferral,
        modeOfTransportation,
        performanceStatus,
        admissionDepartment,
        date,
        summary,
        causeOfAdmission,
        notes
    };

    admissionsList.push(patient);
    saveToLocalStorage();
    updateDateDropdown('admissions');
    renderAdmissionsTable();
    renderDashboard();

    // Reset Form
    document.getElementById('form-admissions').reset();
    document.getElementById('adm-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('adm-triage').value = "3";
    document.getElementById('adm-referral').value = "Home";
    document.getElementById('adm-transport').value = "Private Car";
    document.getElementById('adm-performance').value = "Walking";
    document.getElementById('adm-department').value = "Treatment room";

    // Close the Modal
    closeAddModal('admissions');
}

function getTriageBadge(score) {
    switch(score) {
        case '1': return `<span class="badge badge-danger">1 - Resuscitation</span>`;
        case '2': return `<span class="badge badge-danger" style="background-color:#ffedd5; color:#ea580c;">2 - Emergent</span>`;
        case '3': return `<span class="badge badge-warning">3 - Urgent</span>`;
        case '4': return `<span class="badge badge-success">4 - Less Urgent</span>`;
        case '5': return `<span class="badge badge-info">5 - Non-Urgent</span>`;
        default: return `<span class="badge badge-neutral">${score}</span>`;
    }
}

function renderAdmissionsTable() {
    const tbody = document.querySelector('#table-admissions tbody');
    tbody.innerHTML = '';
    
    const filterDate = document.getElementById('filter-date-admissions')?.value || 'all';
    let filteredList = [...admissionsList];
    if (filterDate !== 'all') {
        filteredList = filteredList.filter(p => p.date === filterDate);
    }
    
    document.getElementById('counter-admissions').innerText = filteredList.length;

    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14">
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
                        <h3>No planned admissions</h3>
                        <p>${admissionsList.length === 0 ? "Fill out the admission fields or upload Excel records in the Smart Import tab." : "No admissions scheduled for this date."}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Sort by Date ascending
    const sortedList = filteredList.sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedList.forEach(patient => {
        const tr = document.createElement('tr');
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('.no-print')) {
                return;
            }
            openEditPatient('admissions', patient.id);
        });
        tr.innerHTML = `
            <td style="font-weight:600; white-space:nowrap;">${patient.name}</td>
            <td><code>${patient.fileNumber}</code></td>
            <td>${patient.age}</td>
            <td>${getTriageBadge(patient.triageScore)}</td>
            <td style="white-space:nowrap;">${patient.primaryPhysician}</td>
            <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${patient.summary || ''}">
                ${patient.summary || '-'}
            </td>
            <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${patient.causeOfAdmission || ''}">
                ${patient.causeOfAdmission || '-'}
            </td>
            <td>${patient.placeOfReferral}</td>
            <td>${patient.modeOfTransportation}</td>
            <td>${patient.performanceStatus}</td>
            <td><span class="badge badge-neutral">${patient.admissionDepartment}</span></td>
            <td>${formatDateDisplay(patient.date)}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${patient.notes || ''}">
                ${patient.notes || '-'}
            </td>
            <td class="no-print">
                <div class="table-actions">
                    <button class="action-btn edit" onclick="openEditPatient('admissions', '${patient.id}')" title="Edit Record">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-btn delete" onclick="deletePatient('admissions', '${patient.id}')" title="Delete Record">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterAdmissionsTable() {
    const query = document.getElementById('search-admissions').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#table-admissions tbody tr');
    
    rows.forEach(row => {
        if (row.querySelector('.empty-state')) return;
        
        let match = false;
        // Search in Name (col 0), File (col 1), Physician (col 4), Dept (col 10), Notes (col 12)
        const nameText = row.cells[0].innerText.toLowerCase();
        const fileText = row.cells[1].innerText.toLowerCase();
        const physText = row.cells[4].innerText.toLowerCase();
        const deptText = row.cells[10].innerText.toLowerCase();
        const notesText = row.cells[12].innerText.toLowerCase();
        
        if (nameText.includes(query) || fileText.includes(query) || physText.includes(query) || deptText.includes(query) || notesText.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}


// FOLLOW-UP LOGIC
function addFollowUpPatient(event) {
    event.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const fileNumber = document.getElementById('f-file').value.trim();
    const date = document.getElementById('f-date').value;
    const task = document.getElementById('f-task').value.trim();

    const patient = {
        id: Date.now().toString(),
        name,
        phone,
        fileNumber,
        date,
        task,
        taskResult: ''
    };

    followUpList.push(patient);
    saveToLocalStorage();
    updateDateDropdown('followup');
    renderFollowUpTable();
    renderDashboard();

    // Reset Form
    document.getElementById('form-followup').reset();
    document.getElementById('f-date').value = new Date().toISOString().split('T')[0];

    // Close the Modal
    closeAddModal('followup');
}

function renderFollowUpTable() {
    const tbody = document.querySelector('#table-followup tbody');
    tbody.innerHTML = '';
    
    const filterDate = document.getElementById('filter-date-followup')?.value || 'all';
    let filteredList = [...followUpList];
    if (filterDate !== 'all') {
        filteredList = filteredList.filter(p => p.date === filterDate);
    }
    
    document.getElementById('counter-followup').innerText = filteredList.length;

    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <h3>No follow-up patients</h3>
                        <p>${followUpList.length === 0 ? "Fill out the follow-up fields or import patient sheets to start tracking communications." : "No follow-up scheduled for this date."}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const sortedList = filteredList.sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedList.forEach(patient => {
        const tr = document.createElement('tr');
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('.no-print')) {
                return;
            }
            openEditPatient('followup', patient.id);
        });
        tr.innerHTML = `
            <td style="font-weight: 600;">${patient.name}</td>
            <td><strong>${patient.phone}</strong></td>
            <td><code>${patient.fileNumber}</code></td>
            <td>${formatDateDisplay(patient.date)}</td>
            <td style="font-size: 0.85rem; max-width: 250px;" title="${patient.task}">${patient.task}</td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                    <input type="text" class="form-control" style="padding: 6px 10px; font-size: 0.85rem;" id="res-input-${patient.id}" value="${patient.taskResult || ''}" placeholder="Enter result...">
                    <button class="btn btn-primary btn-sm" onclick="saveFollowUpResult('${patient.id}')" title="Save Result" style="padding: 6px 10px; height: 32px; flex-shrink: 0;">
                        <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke-width: 3;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    </button>
                </div>
            </td>
            <td class="no-print">
                <div class="table-actions">
                    <button class="action-btn edit" onclick="openEditPatient('followup', '${patient.id}')" title="Edit Patient">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-btn delete" onclick="deletePatient('followup', '${patient.id}')" title="Delete Patient">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveFollowUpResult(id) {
    const inputVal = document.getElementById(`res-input-${id}`).value.trim();
    const idx = followUpList.findIndex(p => p.id === id);
    if (idx !== -1) {
        followUpList[idx].taskResult = inputVal;
        saveToLocalStorage();
        alert("Follow-up result saved successfully.");
    }
}

function filterFollowUpTable() {
    const query = document.getElementById('search-followup').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#table-followup tbody tr');
    
    rows.forEach(row => {
        if (row.querySelector('.empty-state')) return;
        
        const nameText = row.cells[0].innerText.toLowerCase();
        const phoneText = row.cells[1].innerText.toLowerCase();
        const fileText = row.cells[2].innerText.toLowerCase();
        const taskText = row.cells[3].innerText.toLowerCase();
        
        if (nameText.includes(query) || phoneText.includes(query) || fileText.includes(query) || taskText.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function copyFollowUpList() {
    if (followUpList.length === 0) {
        alert("The follow-up list is empty.");
        return;
    }
    
    // Header for TSV copy
    let tsvText = "File/ID Number\tRequested Task\n";
    followUpList.forEach(patient => {
        tsvText += `${patient.fileNumber}\t${patient.task}\n`;
    });
    
    // Copy using clipboard API
    navigator.clipboard.writeText(tsvText).then(() => {
        alert("Success! All patient IDs and tasks copied to the clipboard as a table.\nYou can now paste (Ctrl+V) directly into Excel, Word, WhatsApp, etc.");
    }).catch(err => {
        console.error("Failed to copy clipboard: ", err);
        // Fallback for older browsers/security contexts
        const textarea = document.createElement("textarea");
        textarea.value = tsvText;
        textarea.style.position = "fixed";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
            alert("Success! All patient IDs and tasks copied to the clipboard.");
        } catch (e) {
            alert("Unable to copy automatically. Please try again.");
        }
        document.body.removeChild(textarea);
    });
}


// DELETE RECORD LOGIC
function deletePatient(type, id) {
    if (confirm("Are you sure you want to delete this patient record?")) {
        if (type === 'portcath') {
            portCathList = portCathList.filter(p => p.id !== id);
            renderPortCathTable();
        } else if (type === 'admissions') {
            admissionsList = admissionsList.filter(p => p.id !== id);
            renderAdmissionsTable();
        } else if (type === 'followup') {
            followUpList = followUpList.filter(p => p.id !== id);
            renderFollowUpTable();
        }
        saveToLocalStorage();
        renderDashboard();
    }
}


// EDIT PATIENT MODAL HANDLERS
function openEditPatient(type, id) {
    currentEditType = type;
    currentEditId = id;
    
    const modal = document.getElementById('modal-edit');
    const body = document.getElementById('modal-edit-body');
    
    modal.classList.add('active');

    if (type === 'portcath') {
        const patient = portCathList.find(p => p.id === id);
        document.getElementById('modal-edit-title').innerText = "Edit Port Cath Patient";
        body.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="edit-name">Patient Name</label>
                <input type="text" id="edit-name" class="form-control" value="${patient.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-file">File Number</label>
                <input type="text" id="edit-file" class="form-control" value="${patient.fileNumber}" required>
            </div>
            <div class="form-group double">
                <div>
                    <label class="form-label" for="edit-date">Procedure Date</label>
                    <input type="date" id="edit-date" class="form-control" value="${patient.date}" required>
                </div>
                <div>
                    <label class="form-label" for="edit-weight">Weight (kg)</label>
                    <input type="number" step="0.1" id="edit-weight" class="form-control" value="${patient.weight}" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-notes">Notes</label>
                <textarea id="edit-notes" class="form-control">${patient.notes || ''}</textarea>
            </div>
        `;
    } else if (type === 'admissions') {
        const patient = admissionsList.find(p => p.id === id);
        document.getElementById('modal-edit-title').innerText = "Edit Admission Details";
        body.innerHTML = `
            <div class="form-group double">
                <div>
                    <label class="form-label" for="edit-name">Patient Name</label>
                    <input type="text" id="edit-name" class="form-control" value="${patient.name}" required>
                </div>
                <div>
                    <label class="form-label" for="edit-file">File Number</label>
                    <input type="text" id="edit-file" class="form-control" value="${patient.fileNumber}" required>
                </div>
            </div>
            <div class="form-group double">
                <div>
                    <label class="form-label" for="edit-age">Age</label>
                    <input type="number" id="edit-age" class="form-control" value="${patient.age}" required>
                </div>
                <div>
                    <label class="form-label" for="edit-triage">Triage Score</label>
                    <select id="edit-triage" class="form-control" required>
                        <option value="1" ${patient.triageScore==='1'?'selected':''}>1 - Resuscitation</option>
                        <option value="2" ${patient.triageScore==='2'?'selected':''}>2 - Emergent</option>
                        <option value="3" ${patient.triageScore==='3'?'selected':''}>3 - Urgent</option>
                        <option value="4" ${patient.triageScore==='4'?'selected':''}>4 - Less Urgent</option>
                        <option value="5" ${patient.triageScore==='5'?'selected':''}>5 - Non-Urgent</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-physician">Primary Physician</label>
                <input type="text" id="edit-physician" class="form-control" value="${patient.primaryPhysician}" required>
            </div>
            <div class="form-group double">
                <div>
                    <label class="form-label" for="edit-referral">Place of Referral</label>
                    <select id="edit-referral" class="form-control">
                        <option value="Home" ${patient.placeOfReferral==='Home'?'selected':''}>Home</option>
                        <option value="Hospital" ${patient.placeOfReferral==='Hospital'?'selected':''}>Hospital</option>
                    </select>
                </div>
                <div>
                    <label class="form-label" for="edit-transport">Transportation</label>
                    <select id="edit-transport" class="form-control">
                        <option value="Private Car" ${patient.modeOfTransportation==='Private Car'?'selected':''}>Private Car</option>
                        <option value="Taxi" ${patient.modeOfTransportation==='Taxi'?'selected':''}>Taxi</option>
                        <option value="Hospital Bus" ${patient.modeOfTransportation==='Hospital Bus'?'selected':''}>Hospital Bus</option>
                        <option value="Ambulance" ${patient.modeOfTransportation==='Ambulance'?'selected':''}>Ambulance</option>
                    </select>
                </div>
            </div>
            <div class="form-group double">
                <div>
                    <label class="form-label" for="edit-performance">Performance Status</label>
                    <select id="edit-performance" class="form-control">
                        <option value="Walking" ${patient.performanceStatus==='Walking'?'selected':''}>Walking</option>
                        <option value="Bedridden" ${patient.performanceStatus==='Bedridden'?'selected':''}>Bedridden</option>
                        <option value="Wheelchair" ${patient.performanceStatus==='Wheelchair'?'selected':''}>Wheelchair</option>
                    </select>
                </div>
                <div>
                    <label class="form-label" for="edit-department">Admission Dept</label>
                    <select id="edit-department" class="form-control" required>
                        <option value="Treatment room" ${patient.admissionDepartment==='Treatment room'?'selected':''}>Treatment room</option>
                        <option value="Day care" ${patient.admissionDepartment==='Day care'?'selected':''}>Day care</option>
                        <option value="Hospital Admission" ${patient.admissionDepartment==='Hospital Admission'?'selected':''}>Hospital Admission</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-date">Date of Admission</label>
                <input type="date" id="edit-date" class="form-control" value="${patient.date}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-summary">Brief Summary of the Case</label>
                <input type="text" id="edit-summary" class="form-control" value="${patient.summary || ''}">
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-cause">Cause of Admission</label>
                <input type="text" id="edit-cause" class="form-control" value="${patient.causeOfAdmission || ''}">
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-notes">Notes</label>
                <textarea id="edit-notes" class="form-control">${patient.notes || ''}</textarea>
            </div>
        `;
    } else if (type === 'followup') {
        const patient = followUpList.find(p => p.id === id);
        document.getElementById('modal-edit-title').innerText = "Edit Follow-up Patient";
        body.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="edit-name">Patient Name</label>
                <input type="text" id="edit-name" class="form-control" value="${patient.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-phone">Phone Number</label>
                <input type="text" id="edit-phone" class="form-control" value="${patient.phone}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-file">File Number / ID</label>
                <input type="text" id="edit-file" class="form-control" value="${patient.fileNumber}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-date">Follow-up Date</label>
                <input type="date" id="edit-date" class="form-control" value="${patient.date || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-task">Requested Task</label>
                <textarea id="edit-task" class="form-control" required>${patient.task}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-result">Task Result</label>
                <textarea id="edit-result" class="form-control">${patient.taskResult || ''}</textarea>
            </div>
        `;
    }
}

function closeEditModal() {
    document.getElementById('modal-edit').classList.remove('active');
    currentEditType = null;
    currentEditId = null;
}

function saveEditedPatient() {
    const name = document.getElementById('edit-name').value.trim();
    const fileNumber = document.getElementById('edit-file').value.trim();
    const dateElem = document.getElementById('edit-date');
    const date = dateElem ? dateElem.value : '';

    if (!name || !fileNumber || !date) {
        alert("Please fill in all required fields.");
        return;
    }

    if (currentEditType === 'portcath') {
        const weight = parseFloat(document.getElementById('edit-weight').value);
        if (isNaN(weight)) {
            alert("Please provide a valid weight.");
            return;
        }
        
        const idx = portCathList.findIndex(p => p.id === currentEditId);
        if (idx !== -1) {
            portCathList[idx].name = name;
            portCathList[idx].fileNumber = fileNumber;
            portCathList[idx].date = date;
            portCathList[idx].day = getDayName(date);
            portCathList[idx].weight = weight;
            portCathList[idx].notes = document.getElementById('edit-notes').value.trim();
        }
        updateDateDropdown('portcath');
        renderPortCathTable();
    } else if (currentEditType === 'admissions') {
        const age = parseInt(document.getElementById('edit-age').value);
        const triageScore = document.getElementById('edit-triage').value;
        const primaryPhysician = document.getElementById('edit-physician').value.trim();
        const admissionDepartment = document.getElementById('edit-department').value;

        if (isNaN(age) || !primaryPhysician || !admissionDepartment) {
            alert("Please fill in Age, Physician, and Admission Department.");
            return;
        }

        const idx = admissionsList.findIndex(p => p.id === currentEditId);
        if (idx !== -1) {
            admissionsList[idx].name = name;
            admissionsList[idx].fileNumber = fileNumber;
            admissionsList[idx].age = age;
            admissionsList[idx].triageScore = triageScore;
            admissionsList[idx].primaryPhysician = primaryPhysician;
            admissionsList[idx].placeOfReferral = document.getElementById('edit-referral').value;
            admissionsList[idx].modeOfTransportation = document.getElementById('edit-transport').value;
            admissionsList[idx].performanceStatus = document.getElementById('edit-performance').value;
            admissionsList[idx].admissionDepartment = admissionDepartment;
            admissionsList[idx].date = date;
            admissionsList[idx].summary = document.getElementById('edit-summary').value.trim();
            admissionsList[idx].causeOfAdmission = document.getElementById('edit-cause').value.trim();
            admissionsList[idx].notes = document.getElementById('edit-notes').value.trim();
        }
        updateDateDropdown('admissions');
        renderAdmissionsTable();
    } else if (currentEditType === 'followup') {
        const phone = document.getElementById('edit-phone').value.trim();
        const task = document.getElementById('edit-task').value.trim();
        const taskResult = document.getElementById('edit-result').value.trim();
        
        if (!phone || !task) {
            alert("Please fill in all required fields.");
            return;
        }

        const idx = followUpList.findIndex(p => p.id === currentEditId);
        if (idx !== -1) {
            followUpList[idx].name = name;
            followUpList[idx].fileNumber = fileNumber;
            followUpList[idx].phone = phone;
            followUpList[idx].date = date;
            followUpList[idx].task = task;
            followUpList[idx].taskResult = taskResult;
        }
        updateDateDropdown('followup');
        renderFollowUpTable();
    }

    saveToLocalStorage();
    renderDashboard();
    closeEditModal();
}


// DASHBOARD RENDERER
function renderDashboard() {
    // 1. Counters
    document.getElementById('count-widget-portcath').innerText = portCathList.length;
    document.getElementById('count-widget-admissions').innerText = admissionsList.length;
    document.getElementById('count-widget-followup').innerText = followUpList.length;

    // Calculate today's patients
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPortCath = portCathList.filter(p => p.date === todayStr).length;
    const todayAdmissions = admissionsList.filter(a => a.date === todayStr).length;
    document.getElementById('count-widget-today').innerText = todayPortCath + todayAdmissions;

    // 2. Render Port Cath Dashboard list (first 5 elements sorted by date ascending)
    const pcDTableBody = document.querySelector('#dashboard-portcath-table tbody');
    pcDTableBody.innerHTML = '';
    
    const upcomingPortCath = [...portCathList]
        .filter(p => new Date(p.date) >= new Date(new Date().setHours(0,0,0,0)))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    if (upcomingPortCath.length === 0) {
        pcDTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-light); padding: 24px;">No upcoming schedules</td></tr>`;
    } else {
        upcomingPortCath.forEach(patient => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${patient.name}</td>
                <td><code>${patient.fileNumber}</code></td>
                <td>${formatDateDisplay(patient.date)}</td>
                <td>${patient.weight} kg</td>
            `;
            pcDTableBody.appendChild(tr);
        });
    }

    // 3. Render Admissions Dashboard list
    const admDTableBody = document.querySelector('#dashboard-admissions-table tbody');
    admDTableBody.innerHTML = '';

    const upcomingAdmissions = [...admissionsList]
        .filter(a => new Date(a.date) >= new Date(new Date().setHours(0,0,0,0)))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    if (upcomingAdmissions.length === 0) {
        admDTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-light); padding: 24px;">No upcoming admissions</td></tr>`;
    } else {
        upcomingAdmissions.forEach(patient => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${patient.name}</td>
                <td><code>${patient.fileNumber}</code></td>
                <td><span class="badge badge-neutral">${patient.admissionDepartment}</span></td>
                <td>${getTriageBadge(patient.triageScore)}</td>
            `;
            admDTableBody.appendChild(tr);
        });
    }
}


// SMART EXCEL IMPORT LOGIC
// SMART EXCEL IMPORT LOGIC
function handleExcelUpload(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        parseExcelFiles(files);
    }
}

// Automatically parse date from filename (e.g. 25-5.xlsx, 2026-05-25.xlsx, etc.)
function parseDateFromFilename(filename) {
    if (!filename) return '';
    // Strip extension
    const name = filename.replace(/\.[^/.]+$/, "");
    
    // Regular expression to find any sequences of numbers separated by dash, slash or dot.
    // e.g. 25-5-2026, 25/5/2026, 2026-05-25, 25.5.2026, 25-5, etc.
    const datePattern = /(\d{1,4})[-./](\d{1,2})[-./](\d{2,4})|(\d{1,2})[-./](\d{1,2})/;
    const match = name.match(datePattern);
    if (!match) return '';
    
    if (match[3]) {
        // We matched 3 parts (either YYYY-MM-DD or DD-MM-YYYY)
        let part1 = parseInt(match[1], 10);
        let part2 = parseInt(match[2], 10);
        let part3 = parseInt(match[3], 10);
        
        let year, month, day;
        if (part1 > 1000) {
            // YYYY-MM-DD
            year = part1;
            month = part2 - 1;
            day = part3;
        } else {
            // DD-MM-YYYY
            day = part1;
            month = part2 - 1;
            year = part3;
            if (year < 100) year += 2000; // 2-digit year conversion
        }
        
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } else if (match[4] && match[5]) {
        // We matched 2 parts: DD-MM (assume current year)
        let day = parseInt(match[4], 10);
        let month = parseInt(match[5], 10) - 1;
        let year = new Date().getFullYear();
        
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }
    
    return '';
}

function parseExcelFiles(filesList) {
    excelImportedFiles = [];
    let filesParsedCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    Array.from(filesList).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get the first worksheet name
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Extract raw data as array of arrays
                const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                
                if (jsonRows.length > 0) {
                    const headerRowIdx = findHeaderRow(jsonRows);
                    const headers = jsonRows[headerRowIdx].map(h => String(h).trim());
                    
                    // Data rows (everything after header row, filter out completely empty rows)
                    const rows = jsonRows.slice(headerRowIdx + 1).filter(row => {
                        if (!row || row.length === 0) return false;
                        return row.some(cell => cell !== '' && cell !== null && cell !== undefined);
                    });

                    if (rows.length > 0) {
                        // Attempt to auto-detect target date from filename, fallback to today
                        let autoDate = parseDateFromFilename(file.name);
                        if (!autoDate) autoDate = todayStr;

                        excelImportedFiles.push({
                            name: file.name,
                            defaultDate: autoDate,
                            headers: headers,
                            rows: rows,
                            headerRowIdx: headerRowIdx
                        });
                    }
                }
            } catch (err) {
                console.error("Excel Read Error for file: " + file.name, err);
            }

            filesParsedCount++;
            if (filesParsedCount === filesList.length) {
                if (excelImportedFiles.length === 0) {
                    alert("No valid data rows found in the selected Excel files.");
                    return;
                }
                processImportedFiles();
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// Find header row automatically
function findHeaderRow(rows) {
    // Expected header keywords to score rows
    const keywords = ['name', 'code', 'file', 'id', 'no', 'date', 'service', 'notes', 'phone', 'summary', 'cause', 'age'];
    let bestRowIdx = 0;
    let maxMatches = 0;
    
    // Scan first 12 rows
    const searchLimit = Math.min(rows.length, 12);
    for (let r = 0; r < searchLimit; r++) {
        const cells = rows[r];
        if (!Array.isArray(cells)) continue;
        
        let matches = 0;
        cells.forEach(cell => {
            if (cell === null || cell === undefined) return;
            const str = String(cell).toLowerCase();
            keywords.forEach(keyword => {
                if (str.includes(keyword)) {
                    matches++;
                }
            });
        });
        
        if (matches > maxMatches) {
            maxMatches = matches;
            bestRowIdx = r;
        }
    }
    
    return bestRowIdx;
}

// Configure mapping and render config section
function processImportedFiles() {
    // Show preview panel and scroll into view
    document.getElementById('excel-preview-section').style.display = 'block';
    document.getElementById('excel-preview-section').scrollIntoView({ behavior: 'smooth' });

    // Toggle default department visibility
    const targetSelect = document.getElementById('import-target-select');
    const toggleDeptContainer = () => {
        const targetType = targetSelect.value;
        const deptContainer = document.getElementById('import-default-dept-container');
        if (deptContainer) {
            deptContainer.style.display = targetType === 'admissions' ? 'block' : 'none';
        }
    };
    toggleDeptContainer();

    // Setup Target Select change listener
    targetSelect.onchange = () => {
        toggleDeptContainer();
        renderMappingSelectors();
        renderImportPreviewRows();
    };

    // Render file dates config listing
    renderFilesDatesConfig();

    // Render configuration inputs and grid rows
    renderMappingSelectors();
    renderImportPreviewRows();
}

function renderFilesDatesConfig() {
    const container = document.getElementById('import-files-dates-container');
    if (!container) return;
    
    container.innerHTML = '';
    excelImportedFiles.forEach((fileObj, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.gap = '15px';
        div.style.padding = '8px 12px';
        div.style.background = 'var(--bg-card)';
        div.style.border = '1px solid var(--border)';
        div.style.borderRadius = 'var(--border-radius-sm)';
        div.style.flexWrap = 'wrap';
        
        div.innerHTML = `
            <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-main); word-break: break-all;">
                📄 ${fileObj.name} (${fileObj.rows.length} rows)
            </span>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="form-label" style="margin: 0; font-size: 0.8rem; font-weight: 500;">Target Date:</label>
                <input type="date" id="import-file-date-${idx}" class="form-control" style="width: 150px; padding: 4px 8px; font-size: 0.85rem;" value="${fileObj.defaultDate}" onchange="updateFileImportDate(${idx}, this.value)">
            </div>
        `;
        container.appendChild(div);
    });
}

function updateFileImportDate(idx, val) {
    if (excelImportedFiles[idx]) {
        excelImportedFiles[idx].defaultDate = val;
        renderImportPreviewRows();
    }
}

// Auto map helper
function autoDetectColumnIndex(headers, keywords) {
    for (let i = 0; i < headers.length; i++) {
        const hText = headers[i].toLowerCase();
        for (const kw of keywords) {
            if (hText.includes(kw)) {
                return i;
            }
        }
    }
    return -1;
}

// Render dynamic dropdown selectors for columns mapping
function renderMappingSelectors() {
    const wrapper = document.getElementById('mapping-fields-wrapper');
    wrapper.innerHTML = '';

    const targetType = document.getElementById('import-target-select').value;
    
    // Core columns list based on import target
    let targetFields = [];
    if (targetType === 'portcath') {
        targetFields = [
            { id: 'name', label: 'Patient Name', keywords: ['patient name', 'name', 'fullname'] },
            { id: 'fileNumber', label: 'File Number', keywords: ['patient code', 'code', 'file number', 'fileno', 'id'] },
            { id: 'date', label: 'Procedure Date', keywords: ['date', 'appointment date', 'appt date', 'procedure date'] },
            { id: 'notes', label: 'Notes', keywords: ['notes', 'comment', 'remarks', 'folfox'] },
            { id: 'weight', label: 'Weight', keywords: ['weight', 'kg', 'w'] }
        ];
    } else if (targetType === 'admissions') {
        targetFields = [
            { id: 'name', label: 'Patient Name', keywords: ['patient name', 'name', 'fullname'] },
            { id: 'fileNumber', label: 'File Number', keywords: ['patient code', 'code', 'file number', 'fileno', 'id'] },
            { id: 'age', label: 'Age', keywords: ['age', 'years'] },
            { id: 'triageScore', label: 'Triage Score', keywords: ['triage', 'score', 'priority'] },
            { id: 'primaryPhysician', label: 'Primary Physician', keywords: ['physician', 'doctor', 'dr', 'service'] },
            { id: 'admissionDepartment', label: 'Admission Dept', keywords: ['department', 'dept', 'ward'] },
            { id: 'date', label: 'Date of Admission', keywords: ['date', 'appointment date', 'appt date', 'admission date'] },
            { id: 'summary', label: 'Case Summary', keywords: ['summary', 'case', 'diagnosis'] },
            { id: 'causeOfAdmission', label: 'Cause of Admission', keywords: ['cause', 'service', 'reason'] },
            { id: 'notes', label: 'Notes', keywords: ['notes', 'comment', 'remarks', 'folfox'] }
        ];
    } else if (targetType === 'followup') {
        targetFields = [
            { id: 'name', label: 'Patient Name', keywords: ['patient name', 'name', 'fullname'] },
            { id: 'phone', label: 'Phone Number', keywords: ['phone', 'mobile', 'tel', 'telephone', 'number'] },
            { id: 'fileNumber', label: 'File Number / ID', keywords: ['patient code', 'code', 'file number', 'fileno', 'id', 'identity'] },
            { id: 'date', label: 'Follow-up Date', keywords: ['date', 'appointment date', 'appt date', 'follow-up date'] },
            { id: 'task', label: 'Requested Task', keywords: ['task', 'service', 'reason', 'cause', 'procedure', 'notes', 'comment'] }
        ];
    }

    const requiredForTarget = targetType === 'followup' ? ['name', 'phone', 'fileNumber', 'task'] : ['name', 'fileNumber'];
    
    // We map using the headers of the first imported file
    const firstFile = excelImportedFiles[0];
    const headers = firstFile ? firstFile.headers : [];

    targetFields.forEach(field => {
        const item = document.createElement('div');
        item.className = 'mapping-item';
        
        // Auto detect index
        const detectedIdx = autoDetectColumnIndex(headers, field.keywords);
        
        let optionsHtml = `<option value="-1">-- Unmapped / Empty --</option>`;
        headers.forEach((header, idx) => {
            const selected = idx === detectedIdx ? 'selected' : '';
            optionsHtml += `<option value="${idx}" ${selected}>${header || `Col ${idx + 1}`}</option>`;
        });

        const isRequired = requiredForTarget.includes(field.id);
        item.innerHTML = `
            <span>${field.label} ${isRequired ? '*' : ''}</span>
            <select id="map-select-${field.id}" class="form-control" style="padding: 6px 10px; font-size: 0.85rem;" onchange="renderImportPreviewRows()">
                ${optionsHtml}
            </select>
        `;
        wrapper.appendChild(item);
    });
}

// Convert Excel Serial Numbers to string date
function parseExcelDateValue(val) {
    if (val === null || val === undefined || val === '') return '';
    
    if (!isNaN(val) && typeof val === 'number') {
        try {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    }
    
    const str = String(val).trim();
    if (str.includes('/')) {
        const parts = str.split(' ')[0].split('/');
        if (parts.length === 3) {
            let day, month, year;
            if (parts[2].length === 4) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
            } else if (parts[0].length === 4) {
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10);
            } else {
                return '';
            }
            const date = new Date(year, month, day);
            if (!isNaN(date)) return date.toISOString().split('T')[0];
        }
    }
    
    const parsedDate = new Date(str);
    if (!isNaN(parsedDate)) {
        return parsedDate.toISOString().split('T')[0];
    }
    
    return '';
}

// Check Physician Extraction from Service Name
function extractPhysician(serviceName) {
    if (!serviceName) return '';
    const nameStr = String(serviceName);
    
    const drIndex = nameStr.toLowerCase().indexOf('dr.');
    if (drIndex !== -1) {
        const parts = nameStr.substring(drIndex).split('-');
        return parts[0].trim();
    }
    
    const doctors = ['Jalal Qawasmi', 'Qawasmi', 'Hanna Qahoush', 'Fahed Hanna'];
    for (const doc of doctors) {
        if (nameStr.toLowerCase().includes(doc.toLowerCase())) {
            return doc;
        }
    }
    return '';
}

// Extract Age from string or numbers
function parseAgeValue(val) {
    if (val === null || val === undefined || val === '') return '';
    const matches = String(val).match(/\d+/);
    return matches ? parseInt(matches[0], 10) : '';
}

// Extract Weight
function parseWeightValue(val) {
    if (val === null || val === undefined || val === '') return 70.0;
    const matches = String(val).match(/[\d\.]+/);
    return matches ? parseFloat(matches[0]) : 70.0;
}

// Render patient preview list in table before final submission
function renderImportPreviewRows() {
    const theadRow = document.getElementById('table-import-preview-headers');
    const tbody = document.getElementById('table-import-preview-body');
    
    tbody.innerHTML = '';
    
    // Clear dynamic headers (remove everything except the checkbox header)
    while (theadRow.cells.length > 1) {
        theadRow.deleteCell(1);
    }

    const targetType = document.getElementById('import-target-select').value;
    
    let previewFields = [];
    if (targetType === 'portcath') {
        previewFields = [
            { id: 'name', label: 'Patient Name' },
            { id: 'fileNumber', label: 'File Number' },
            { id: 'date', label: 'Date' },
            { id: 'weight', label: 'Weight' },
            { id: 'notes', label: 'Notes' }
        ];
    } else if (targetType === 'admissions') {
        previewFields = [
            { id: 'name', label: 'Patient Name' },
            { id: 'fileNumber', label: 'File Number' },
            { id: 'age', label: 'Age' },
            { id: 'triageScore', label: 'Triage' },
            { id: 'primaryPhysician', label: 'Physician' },
            { id: 'admissionDepartment', label: 'Dept' },
            { id: 'date', label: 'Date' }
        ];
    } else if (targetType === 'followup') {
        previewFields = [
            { id: 'name', label: 'Patient Name' },
            { id: 'phone', label: 'Phone Number' },
            { id: 'fileNumber', label: 'File / ID No.' },
            { id: 'date', label: 'Date' },
            { id: 'task', label: 'Requested Task' }
        ];
    }

    // Add headers to preview table
    previewFields.forEach(field => {
        const th = document.createElement('th');
        th.innerText = field.label;
        theadRow.appendChild(th);
    });

    // Add "Source File" to headers
    const thFile = document.createElement('th');
    thFile.innerText = "Source File";
    theadRow.appendChild(thFile);

    let totalRowsCount = 0;
    excelImportedFiles.forEach(f => totalRowsCount += f.rows.length);
    document.getElementById('import-rows-count').innerText = totalRowsCount;

    // Load data from all imported files
    excelImportedFiles.forEach((fileObj, fileIdx) => {
        fileObj.rows.forEach((row, rowIdx) => {
            const tr = document.createElement('tr');
            
            // Checkbox column
            let cellsHtml = `<td><input type="checkbox" class="import-row-check" data-file-idx="${fileIdx}" data-row-idx="${rowIdx}" checked style="width: 18px; height: 18px; cursor: pointer;"></td>`;
            
            previewFields.forEach(field => {
                const selectElem = document.getElementById(`map-select-${field.id}`);
                const colIdx = selectElem ? parseInt(selectElem.value) : -1;
                
                let rawVal = colIdx !== -1 && colIdx < row.length ? row[colIdx] : '';
                let resolvedVal = rawVal;
                
                if (field.id === 'date') {
                    let parsed = parseExcelDateValue(rawVal);
                    if (!parsed) {
                        parsed = fileObj.defaultDate || '';
                    }
                    resolvedVal = parsed ? formatDateDisplay(parsed) : '<span style="color:var(--danger)">Missing Date *</span>';
                } else if (['name', 'fileNumber', 'phone', 'task'].includes(field.id)) {
                    const requiredForTarget = targetType === 'followup' ? ['name', 'phone', 'fileNumber', 'task'] : ['name', 'fileNumber'];
                    if (requiredForTarget.includes(field.id) && !resolvedVal) {
                        resolvedVal = '<span style="color:var(--danger)">Missing *</span>';
                    }
                } else if (field.id === 'weight') {
                    resolvedVal = parseWeightValue(rawVal) + " kg";
                } else if (field.id === 'primaryPhysician') {
                    if (!resolvedVal) {
                        const causeSelect = document.getElementById(`map-select-causeOfAdmission`);
                        const causeColIdx = causeSelect ? parseInt(causeSelect.value) : -1;
                        const causeVal = causeColIdx !== -1 && causeColIdx < row.length ? row[causeColIdx] : '';
                        resolvedVal = extractPhysician(causeVal);
                    }
                } else if (field.id === 'admissionDepartment') {
                    if (!resolvedVal) {
                        resolvedVal = document.getElementById('import-default-dept').value || 'Treatment room';
                    }
                } else if (field.id === 'age') {
                    resolvedVal = parseAgeValue(rawVal);
                }
                
                cellsHtml += `<td>${resolvedVal}</td>`;
            });
            
            // Append source file column
            cellsHtml += `<td style="font-size: 0.8rem; color: var(--text-muted); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${fileObj.name}">${fileObj.name}</td>`;
            
            tr.innerHTML = cellsHtml;
            tbody.appendChild(tr);
        });
    });
}

// Check / Uncheck All Helper
function toggleSelectAllImport(checked) {
    document.querySelectorAll('.import-row-check').forEach(chk => {
        chk.checked = checked;
    });
}

function resetImportTab() {
    document.getElementById('excel-file-input').value = '';
    document.getElementById('excel-preview-section').style.display = 'none';
    excelImportedFiles = [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Core smart import submit
function submitSmartImport() {
    const targetType = document.getElementById('import-target-select').value;
    const checkedBoxes = document.querySelectorAll('.import-row-check:checked');
    
    if (checkedBoxes.length === 0) {
        alert("Please select at least one patient row to import.");
        return;
    }

    // Load mappings
    const mappings = {};
    const requiredFields = targetType === 'followup' ? ['name', 'phone', 'fileNumber', 'task'] : ['name', 'fileNumber'];
    let mappingValid = true;

    // Grab selects
    const selects = document.querySelectorAll(`[id^="map-select-"]`);
    selects.forEach(sel => {
        const fieldId = sel.id.replace('map-select-', '');
        mappings[fieldId] = parseInt(sel.value);
        
        // Validate required fields mapping
        if (requiredFields.includes(fieldId) && mappings[fieldId] === -1) {
            mappingValid = false;
        }
    });

    if (!mappingValid) {
        const requiredNames = targetType === 'followup' ? "Patient Name, Phone Number, File Number / ID, and Requested Task" : "Patient Name and File Number";
        alert(`Please map all required fields (*) before importing: ${requiredNames}.`);
        return;
    }

    let importCount = 0;
    let duplicateCount = 0;

    checkedBoxes.forEach(chk => {
        const fileIdx = parseInt(chk.getAttribute('data-file-idx'));
        const rowIdx = parseInt(chk.getAttribute('data-row-idx'));
        
        const fileObj = excelImportedFiles[fileIdx];
        const row = fileObj.rows[rowIdx];
        
        // Extract fields
        const nameCol = mappings['name'];
        const nameVal = String(row[nameCol] || '').trim();
        
        const fileCol = mappings['fileNumber'];
        const fileVal = String(row[fileCol] || '').trim();
        
        // Resolve date with fallback
        let dateVal = '';
        const dateCol = mappings['date'];
        if (dateCol !== undefined && dateCol !== -1) {
            dateVal = parseExcelDateValue(row[dateCol]);
        }
        if (!dateVal) {
            dateVal = fileObj.defaultDate;
        }

        if (targetType === 'followup') {
            const phoneCol = mappings['phone'];
            const phoneVal = String(row[phoneCol] || '').trim();
            
            const taskCol = mappings['task'];
            const taskVal = String(row[taskCol] || '').trim();

            if (!nameVal || !fileVal || !phoneVal || !taskVal) return;

            // Check duplicates in follow-up list by File No. and Task
            const isDup = followUpList.some(f => f.fileNumber === fileVal && f.task.toLowerCase() === taskVal.toLowerCase());
            if (isDup) {
                duplicateCount++;
                return;
            }

            followUpList.push({
                id: (Date.now() + importCount).toString(),
                name: nameVal,
                phone: phoneVal,
                fileNumber: fileVal,
                date: dateVal,
                task: taskVal,
                taskResult: ''
            });
            importCount++;
        } else {
            // Skip completely invalid rows
            if (!nameVal || !fileVal || !dateVal) return;

            // Notes Column
            const notesCol = mappings['notes'];
            let notesVal = notesCol !== -1 && notesCol < row.length ? String(row[notesCol]).trim() : '';

            if (targetType === 'portcath') {
                // Check duplicates in Port Cath list by file number and date
                const isDup = portCathList.some(p => p.fileNumber === fileVal && p.date === dateVal);
                if (isDup) {
                    duplicateCount++;
                    return;
                }

                const weightCol = mappings['weight'];
                const weightVal = weightCol !== -1 && weightCol < row.length ? parseWeightValue(row[weightCol]) : 70.0;

                portCathList.push({
                    id: (Date.now() + importCount).toString(),
                    name: nameVal,
                    fileNumber: fileVal,
                    date: dateVal,
                    day: getDayName(dateVal),
                    weight: weightVal,
                    notes: notesVal
                });
                importCount++;
            } else {
                // Daily planned admissions list check duplicates
                const isDup = admissionsList.some(a => a.fileNumber === fileVal && a.date === dateVal);
                if (isDup) {
                    duplicateCount++;
                    return;
                }

                // Age
                const ageCol = mappings['age'];
                let ageVal = ageCol !== -1 && ageCol < row.length ? parseAgeValue(row[ageCol]) : '';
                if (ageVal === '') ageVal = 50; // default age if missing

                // Triage
                const triageCol = mappings['triageScore'];
                let triageVal = triageCol !== -1 && triageCol < row.length ? String(row[triageCol]).trim() : '';
                if (!['1', '2', '3', '4', '5'].includes(triageVal)) triageVal = '3'; // Default to 3

                // Physician
                const physCol = mappings['primaryPhysician'];
                let physVal = physCol !== -1 && physCol < row.length ? String(row[physCol]).trim() : '';
                // If empty, check if we can extract it from the cause / service column
                if (!physVal) {
                    const causeCol = mappings['causeOfAdmission'];
                    const causeText = causeCol !== -1 && causeCol < row.length ? String(row[causeCol]).trim() : '';
                    physVal = extractPhysician(causeText);
                    if (!physVal) physVal = 'Unassigned';
                }

                // Department
                const deptCol = mappings['admissionDepartment'];
                let deptVal = deptCol !== -1 && deptCol < row.length ? String(row[deptCol]).trim() : '';
                if (!deptVal) {
                    deptVal = document.getElementById('import-default-dept').value || 'Treatment room';
                }

                // Case Summary
                const sumCol = mappings['summary'];
                const sumVal = sumCol !== -1 && sumCol < row.length ? String(row[sumCol]).trim() : 'Admission scheduled';

                // Cause of admission
                const causeCol = mappings['causeOfAdmission'];
                const causeVal = causeCol !== -1 && causeCol < row.length ? String(row[causeCol]).trim() : 'Under observation';

                admissionsList.push({
                    id: (Date.now() + importCount).toString(),
                    name: nameVal,
                    fileNumber: fileVal,
                    age: parseInt(ageVal),
                    triageScore: triageVal,
                    primaryPhysician: physVal,
                    placeOfReferral: 'Home',
                    modeOfTransportation: 'Private Car',
                    performanceStatus: 'Walking',
                    admissionDepartment: deptVal,
                    date: dateVal,
                    summary: sumVal,
                    causeOfAdmission: causeVal,
                    notes: notesVal
                });
                importCount++;
            }
        }
    });

    saveToLocalStorage();
    updateDateDropdown('portcath');
    updateDateDropdown('admissions');
    updateDateDropdown('followup');
    renderDashboard();
    renderPortCathTable();
    renderAdmissionsTable();
    renderFollowUpTable();
    
    let targetName = "Port Cath Placement List";
    if (targetType === 'admissions') targetName = "Planned Admissions List";
    if (targetType === 'followup') targetName = "WhatsApp & Call Follow-up List";

    let resultMsg = `Successfully imported ${importCount} patients into the ${targetName}.`;
    if (duplicateCount > 0) {
        resultMsg += ` (Skipped ${duplicateCount} duplicate records).`;
    }
    alert(resultMsg);

    // Switch view
    switchTab(targetType);
    resetImportTab();
}


// PRINT MODAL CONTROLLERS
let currentPrintType = null;

function openPrintModal(type) {
    currentPrintType = type;
    const modal = document.getElementById('modal-print');
    if (!modal) return;

    let list = [];
    if (type === 'portcath') list = portCathList;
    else if (type === 'admissions') list = admissionsList;
    else if (type === 'followup') list = followUpList;

    // Extract unique dates
    const dates = [...new Set(list.map(p => p.date).filter(d => !!d))];
    dates.sort((a, b) => new Date(a) - new Date(b));

    // Current selected date in tab dropdown
    const filterSelect = document.getElementById(`filter-date-${type}`);
    const currentSelected = filterSelect ? filterSelect.value : 'all';

    // Update radio text
    const selectedRadioText = document.getElementById('print-mode-selected-text');
    const selectedRadio = document.getElementById('print-mode-selected');
    const allRadio = document.getElementById('print-mode-all');
    
    if (currentSelected !== 'all') {
        selectedRadioText.innerText = `Print Selected Date Only (${formatDateDisplay(currentSelected)})`;
        selectedRadio.disabled = false;
        selectedRadio.checked = true;
    } else {
        selectedRadioText.innerText = `Print Selected Date Only (No specific date selected)`;
        selectedRadio.disabled = true;
        allRadio.checked = true;
    }

    // Fill checkboxes container
    const container = document.getElementById('print-checkboxes-container');
    container.innerHTML = '';
    
    if (dates.length === 0) {
        container.innerHTML = `<span style="grid-column: span 2; color: var(--text-light); text-align: center; font-size: 0.85rem;">No dates available</span>`;
    } else {
        dates.forEach(d => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.style.fontSize = '0.85rem';
            label.style.cursor = 'pointer';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = d;
            chk.className = 'print-date-checkbox';
            chk.checked = true;
            chk.style.width = '16px';
            chk.style.height = '16px';
            chk.style.accentColor = 'var(--primary)';
            
            label.appendChild(chk);
            label.appendChild(document.createTextNode(formatDateDisplay(d)));
            container.appendChild(label);
        });
    }

    // Toggle custom date selection area
    const customRadio = document.getElementById('print-mode-custom');
    const customSection = document.getElementById('print-custom-dates-section');
    const radios = document.getElementsByName('print-mode');
    
    const updateCustomSection = () => {
        if (customRadio.checked) {
            customSection.style.display = 'block';
        } else {
            customSection.style.display = 'none';
        }
    };
    
    radios.forEach(r => {
        r.onchange = updateCustomSection;
    });
    
    updateCustomSection();
    modal.classList.add('active');
}

function closePrintModal() {
    const modal = document.getElementById('modal-print');
    if (modal) modal.classList.remove('active');
    currentPrintType = null;
}

function submitPrintReport() {
    if (!currentPrintType) return;
    
    const type = currentPrintType;
    let list = [];
    if (type === 'portcath') list = portCathList;
    else if (type === 'admissions') list = admissionsList;
    else if (type === 'followup') list = followUpList;

    if (list.length === 0) {
        alert("The list is empty. Nothing to print.");
        return;
    }

    const modeVal = document.querySelector('input[name="print-mode"]:checked').value;
    let datesToPrint = [];

    if (modeVal === 'selected') {
        const filterSelect = document.getElementById(`filter-date-${type}`);
        const currentSelected = filterSelect ? filterSelect.value : 'all';
        if (currentSelected !== 'all') {
            datesToPrint = [currentSelected];
        } else {
            datesToPrint = [...new Set(list.map(p => p.date).filter(d => !!d))];
            datesToPrint.sort((a, b) => new Date(a) - new Date(b));
        }
    } else if (modeVal === 'all') {
        datesToPrint = [...new Set(list.map(p => p.date).filter(d => !!d))];
        datesToPrint.sort((a, b) => new Date(a) - new Date(b));
        if (datesToPrint.length === 0) {
            datesToPrint = ['']; // fallback
        }
    } else if (modeVal === 'custom') {
        const chks = document.querySelectorAll('.print-date-checkbox:checked');
        chks.forEach(c => {
            datesToPrint.push(c.value);
        });
        if (datesToPrint.length === 0) {
            alert("Please select at least one date to print.");
            return;
        }
    }

    closePrintModal();
    generateAndPrintReport(type, datesToPrint, modeVal);
}

// PROFESSIONAL PRINT AND PDF EXPORT GENERATOR
function generateAndPrintReport(type, dates, mode) {
    const printContainer = document.getElementById('print-container');
    printContainer.innerHTML = '';

    const today = new Date();
    const formattedPrintDate = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let list = [];
    if (type === 'portcath') list = portCathList;
    else if (type === 'admissions') list = admissionsList;
    else if (type === 'followup') list = followUpList;

    let fullHtml = '';

    dates.forEach((date, index) => {
        // Filter patients for this date
        const datePatients = list.filter(p => (p.date || '') === date);
        if (datePatients.length === 0 && date !== '') return; // Skip if empty and not fallback

        // Sort patients by procedure date then name
        const sortedPatients = datePatients.sort((a, b) => a.name.localeCompare(b.name));

        let rowsHtml = '';
        if (type === 'portcath') {
            sortedPatients.forEach((patient, idx) => {
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${idx + 1}</td>
                        <td style="font-weight: 700;">${patient.name}</td>
                        <td><code>${patient.fileNumber}</code></td>
                        <td>${formatDateDisplay(patient.date)} (${patient.day})</td>
                        <td style="text-align: center; font-weight: 600;">${patient.weight} kg</td>
                        <td>${patient.notes || '-'}</td>
                    </tr>
                `;
            });

            fullHtml += `
                <div class="print-page-section">
                    <div class="print-report-header" style="align-items: center;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="logo.png" alt="Augusta Victoria Hospital Logo" style="height: 50px; object-fit: contain;">
                            <div class="hospital-info">
                                <h2>Port Cath Placements Schedule</h2>
                                <p>Clinical Operations Department</p>
                            </div>
                        </div>
                        <div class="report-meta">
                            <h3>Patient Records</h3>
                            <p>Procedure Date: ${formatDateDisplay(date)} (${getDayName(date)})</p>
                            <p>Printed: ${formattedPrintDate}</p>
                        </div>
                    </div>

                    <div class="print-summary">
                        <div class="print-summary-item">
                            <span class="label">Total Schedules</span>
                            <span class="val">${sortedPatients.length}</span>
                        </div>
                        <div class="print-summary-item">
                            <span class="label">Layout Style</span>
                            <span class="val">Portrait (طولي)</span>
                        </div>
                    </div>

                    <table class="print-table">
                        <thead>
                            <tr>
                                <th style="width: 5%; text-align: center;">#</th>
                                <th style="width: 30%;">Patient Name</th>
                                <th style="width: 15%;">File Number</th>
                                <th style="width: 25%;">Date & Day</th>
                                <th style="width: 10%; text-align: center;">Weight</th>
                                <th style="width: 15%;">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="print-footer-signature">
                        <div class="signature-box">
                            <div class="signature-line"></div>
                            <span class="signature-title">Prepared By (Signature)</span>
                        </div>
                        <div class="signature-box">
                            <div class="signature-line"></div>
                            <span class="signature-title">Charge Nurse Approval</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'admissions') {
            sortedPatients.forEach((patient, idx) => {
                let triageStr = '';
                switch(patient.triageScore) {
                    case '1': triageStr = '1 (Resuscitation)'; break;
                    case '2': triageStr = '2 (Emergent)'; break;
                    case '3': triageStr = '3 (Urgent)'; break;
                    case '4': triageStr = '4 (Less Urgent)'; break;
                    case '5': triageStr = '5 (Non-Urgent)'; break;
                    default: triageStr = patient.triageScore;
                }

                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${idx + 1}</td>
                        <td style="font-weight: 700;">${patient.name}</td>
                        <td><code>${patient.fileNumber}</code></td>
                        <td style="text-align: center;">${patient.age}</td>
                        <td>${triageStr}</td>
                        <td>${patient.primaryPhysician}</td>
                        <td>${patient.summary || '-'}</td>
                        <td>${patient.causeOfAdmission || '-'}</td>
                        <td>${patient.placeOfReferral}</td>
                        <td>${patient.modeOfTransportation}</td>
                        <td>${patient.performanceStatus}</td>
                        <td>${patient.admissionDepartment}</td>
                        <td>${formatDateDisplay(patient.date)}</td>
                    </tr>
                `;
            });

            fullHtml += `
                <div class="print-page-section">
                    <div class="print-report-header" style="align-items: center;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="logo.png" alt="Augusta Victoria Hospital Logo" style="height: 50px; object-fit: contain;">
                            <div class="hospital-info">
                                <h2>Daily Planned Admissions – Patient Information</h2>
                                <p>Augusta Victoria Hospital</p>
                            </div>
                        </div>
                        <div class="report-meta">
                            <h3>Patient Records</h3>
                            <p>Admission Date: ${formatDateDisplay(date)} (${getDayName(date)})</p>
                            <p>Printed: ${formattedPrintDate}</p>
                        </div>
                    </div>

                    <table class="print-table">
                        <thead>
                            <tr>
                                <th style="width: 3%; text-align: center;">#</th>
                                <th style="width: 15%;">Patient Name</th>
                                <th style="width: 9%;">File No.</th>
                                <th style="width: 3%; text-align: center;">Age</th>
                                <th style="width: 10%;">Triage</th>
                                <th style="width: 10%;">Physician</th>
                                <th style="width: 12%;">Brief Case Summary</th>
                                <th style="width: 12%;">Cause of Admission</th>
                                <th style="width: 6%;">Referral</th>
                                <th style="width: 8%;">Transport</th>
                                <th style="width: 7%;">Performance</th>
                                <th style="width: 8%;">Department</th>
                                <th style="width: 7%;">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (type === 'followup') {
            sortedPatients.forEach((patient, idx) => {
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${idx + 1}</td>
                        <td style="font-weight: 700;">${patient.name}</td>
                        <td><strong>${patient.phone}</strong></td>
                        <td><code>${patient.fileNumber}</code></td>
                        <td>${formatDateDisplay(patient.date)}</td>
                        <td>${patient.task}</td>
                        <td>${patient.taskResult || '-'}</td>
                    </tr>
                `;
            });

            fullHtml += `
                <div class="print-page-section">
                    <div class="print-report-header" style="align-items: center;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="logo.png" alt="Augusta Victoria Hospital Logo" style="height: 50px; object-fit: contain;">
                            <div class="hospital-info">
                                <h2>WhatsApp & Call Follow-up – Patient Information</h2>
                                <p>Augusta Victoria Hospital</p>
                            </div>
                        </div>
                        <div class="report-meta">
                            <h3>Patient Records</h3>
                            <p>Follow-up Date: ${formatDateDisplay(date)}</p>
                            <p>Printed: ${formattedPrintDate}</p>
                        </div>
                    </div>

                    <table class="print-table">
                        <thead>
                            <tr>
                                <th style="width: 5%; text-align: center;">#</th>
                                <th style="width: 20%;">Patient Name</th>
                                <th style="width: 13%;">Phone Number</th>
                                <th style="width: 12%;">File / ID No.</th>
                                <th style="width: 12%;">Date</th>
                                <th style="width: 18%;">Requested Task</th>
                                <th style="width: 20%;">Task Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Add page break if not last element
        if (index < dates.length - 1) {
            fullHtml += '<div class="print-page-break"></div>';
        }
    });

    if (!fullHtml) {
        alert("No patient records to print for the selected date(s).");
        return;
    }

    printContainer.innerHTML = fullHtml;

    if (type === 'portcath' || type === 'followup') {
        printContainer.className = 'print-portrait-report';
        document.body.className = 'print-portrait-mode';
    } else {
        printContainer.className = 'print-landscape-report';
        document.body.className = 'print-landscape-mode';
    }

}

// ==========================================
// TUMOR BOARD PATIENT FOLLOW-UP MODULE
// ==========================================

function addTumorBoardPatient(event) {
    event.preventDefault();
    const name = document.getElementById('tb-name').value.trim();
    const fileNumber = document.getElementById('tb-file').value.trim();
    const age = parseInt(document.getElementById('tb-age').value) || 50;
    const physician = document.getElementById('tb-physician').value.trim();
    const diagnosis = document.getElementById('tb-diagnosis').value.trim();

    if (fileNumber && tumorBoardList.some(p => p.fileNumber === fileNumber)) {
        alert("A patient with this File Number (MRN) already exists.");
        return;
    }

    const patient = {
        id: Date.now().toString(),
        name,
        fileNumber,
        age,
        physician,
        diagnosis,
        notes: '',
        tasks: []
    };

    tumorBoardList.push(patient);
    saveToLocalStorage();
    renderTumorBoardTable();
    renderDashboard();

    document.getElementById('form-tumorboard').reset();
    closeAddModal('tumorboard');
}

function renderTumorBoardTable() {
    const tbody = document.querySelector('#table-tumorboard tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = document.getElementById('search-tumorboard')?.value.toLowerCase().trim() || '';
    
    let filteredList = [...tumorBoardList];
    if (query) {
        filteredList = filteredList.filter(p => 
            p.name.toLowerCase().includes(query) ||
            p.fileNumber.toLowerCase().includes(query) ||
            p.physician.toLowerCase().includes(query) ||
            p.diagnosis.toLowerCase().includes(query) ||
            (p.notes && p.notes.toLowerCase().includes(query))
        );
    }

    document.getElementById('counter-tumorboard').innerText = filteredList.length;

    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" style="stroke: var(--text-light); width: 48px; height: 48px; fill: none; margin-bottom: 12px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        <h3>No oncology patients found</h3>
                        <p>${tumorBoardList.length === 0 ? "Import a Word file or add patients manually to begin tracking." : "No patients matched your search."}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    filteredList.sort((a, b) => a.name.localeCompare(b.name));

    filteredList.forEach(patient => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
                return;
            }
            openPatientProfile(patient.id);
        });

        const totalTasks = patient.tasks.length;
        const completedTasks = patient.tasks.filter(t => t.status === 'completed').length;
        const pendingTasks = totalTasks - completedTasks;
        
        let statusBadgeHtml = '';
        if (totalTasks === 0) {
            statusBadgeHtml = `<span class="badge badge-neutral">No tasks</span>`;
        } else if (pendingTasks === 0) {
            statusBadgeHtml = `<span class="badge badge-success">All ${totalTasks} done</span>`;
        } else {
            statusBadgeHtml = `<span class="badge badge-warning">${pendingTasks} pending</span>`;
        }

        tr.innerHTML = `
            <td style="font-weight: 600;">${patient.name}</td>
            <td><code>${patient.fileNumber}</code></td>
            <td>${patient.age}</td>
            <td>${patient.physician}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${patient.diagnosis}">
                ${patient.diagnosis}
            </td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${patient.notes || ''}">
                ${patient.notes || ''}
            </td>
            <td>${statusBadgeHtml}</td>
            <td class="no-print">
                <div class="table-actions">
                    <button class="action-btn edit" onclick="openPatientProfile('${patient.id}')" title="View/Edit Profile">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-btn delete" onclick="deleteTumorBoardPatient('${patient.id}')" title="Delete Patient">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTumorBoardTable() {
    renderTumorBoardTable();
}

function deleteTumorBoardPatient(id) {
    if (confirm("Are you sure you want to delete this oncology patient and all their follow-up tasks?")) {
        tumorBoardList = tumorBoardList.filter(p => p.id !== id);
        saveToLocalStorage();
        renderTumorBoardTable();
        renderDashboard();
    }
}

function openImportWordModal() {
    document.getElementById('modal-import-word').classList.add('active');
    document.getElementById('word-file-input').value = '';
    document.getElementById('word-paste-text').value = '';
    document.getElementById('word-preview-section').style.display = 'none';
    document.getElementById('btn-submit-word-import').disabled = true;
}

function closeImportWordModal() {
    document.getElementById('modal-import-word').classList.remove('active');
}

function handleWordFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
            .then(function(result) {
                const html = result.value;
                const parsedPatients = parseTumorBoardWordHtml(html);
                renderWordImportPreview(parsedPatients);
            })
            .catch(function(err) {
                console.error("Mammoth error:", err);
                alert("Failed to parse Word document: " + err.message);
            });
    };
    reader.readAsArrayBuffer(file);
}

function parseWordPastedText() {
    const textVal = document.getElementById('word-paste-text').value.trim();
    if (!textVal) {
        alert("Please paste some text first.");
        return;
    }
    const parsedPatients = parseTumorBoardWordText(textVal);
    renderWordImportPreview(parsedPatients);
}

function parseTumorBoardWordText(text) {
    const rawLines = text.split(/\r?\n/);
    const patients = [];
    
    // Check if copy-pasted text has tabs (indicates a direct Word table copy)
    const isTabSeparated = rawLines.some(line => line.includes('\t'));
    
    if (isTabSeparated) {
        const rowsText = [];
        let currentRow = '';
        
        rawLines.forEach((line) => {
            // Check if this line starts a new row: starts with index digits, optional dot, and a tab
            if (/^\s*\d+\.?\t/.test(line)) {
                if (currentRow) {
                    rowsText.push(currentRow);
                }
                currentRow = line;
            } else {
                if (!currentRow) {
                    // Header row or metadata lines before first item
                    currentRow = line;
                } else {
                    currentRow += '\n' + line;
                }
            }
        });
        if (currentRow) {
            rowsText.push(currentRow);
        }
        
        let colIndex = 0;
        let colMrn = 1;
        let colDiagnosis = 2;
        let colPhysician = 3;
        let colNotes = 4;
        let hasHeaderDetected = false;

        // Detect if the first row is a header row
        if (rowsText.length > 0) {
            const firstRowCells = rowsText[0].split('\t').map(c => c.trim().toLowerCase());
            const hasHeaderSign = firstRowCells.some(c => c.includes('#') || c.includes('mrn') || c.includes('history') || c.includes('physician') || c.includes('points') || c.includes('discussion'));
            if (hasHeaderSign) {
                hasHeaderDetected = true;
                firstRowCells.forEach((colText, idx) => {
                    if (colText.includes('#') || colText === 'no' || colText === 'index') {
                        colIndex = idx;
                    } else if (colText.includes('mrn') || colText.includes('file')) {
                        colMrn = idx;
                    } else if (colText.includes('history') || colText.includes('brief') || colText.includes('diagnosis')) {
                        colDiagnosis = idx;
                    } else if (colText.includes('physician') || colText.includes('doctor') || colText.includes('responsible') || colText === 'dr') {
                        colPhysician = idx;
                    } else if (colText.includes('discussion') || colText.includes('points') || colText.includes('notes') || colText.includes('follow')) {
                        colNotes = idx;
                    }
                });
            }
        }

        rowsText.forEach((rowText, idx) => {
            const cells = rowText.split('\t').map(c => c.trim());
            // Skip header if matched
            if (idx === 0 && hasHeaderDetected) {
                return;
            }
            
            if (cells.length < 2) return;
            
            let index = '';
            if (cells[colIndex]) {
                index = cells[colIndex].replace(/\.$/, '').trim();
            } else {
                index = String(idx);
            }
            if (isNaN(parseInt(index))) return;
            
            let fileNumber = '';
            let diagnosis = '';
            let physician = 'Unassigned';
            let notes = '';
            
            // If the row contains enough cells, map them using the detected columns
            if (cells.length > Math.max(colMrn, colDiagnosis, colPhysician, colNotes)) {
                fileNumber = cells[colMrn] || '';
                diagnosis = cells[colDiagnosis] || '';
                physician = cells[colPhysician] || 'Unassigned';
                notes = cells[colNotes] || '';
            } else {
                // Heuristic parsing fallback if column count is off
                for (let c = 0; c < cells.length; c++) {
                    if (c === colIndex) continue;
                    const text = cells[c];
                    if (!text) continue;
                    
                    if (/^\d{5,8}$/.test(text)) {
                        fileNumber = text;
                    } else if (/^Dr\.?\s*\w+/i.test(text) || text.toLowerCase().startsWith('dr ')) {
                        physician = text;
                    } else if (/A\s*\d+\s*(?:y\/o|year|yr)/i.test(text) || text.toLowerCase().includes('patient') || text.toLowerCase().includes('female') || text.toLowerCase().includes('male')) {
                        diagnosis = text;
                    } else {
                        if (notes) notes += '\n';
                        notes += text;
                    }
                }
            }

            // Fallback diagnostics if empty
            if (!diagnosis && cells[colDiagnosis]) {
                diagnosis = cells[colDiagnosis];
            }
            if (!diagnosis) {
                let longest = '';
                cells.forEach(c => { if (c.length > longest.length) longest = c; });
                diagnosis = longest || 'Oncology follow-up';
            }
            
            let age = 50;
            const ageMatch = diagnosis.match(/A\s*(\d+)\s*(?:y\/o|year|yr)/i) || diagnosis.match(/A(\d+)\s*(?:y\/o|year|yr)/i);
            if (ageMatch) {
                age = parseInt(ageMatch[1], 10);
            }
            
            const fallbackName = fileNumber ? `Patient #${fileNumber}` : `Patient #${index}`;
            
            patients.push({
                index: index,
                name: fallbackName,
                fileNumber: fileNumber,
                age: age,
                physician: physician || 'Unassigned',
                diagnosis: diagnosis,
                notes: notes,
                tasks: []
            });
        });
        
        return patients;
    }

    // Fallback: sequential line-by-line parsing for non-tabbed text
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
    let currentPatient = null;
    let hasPhysician = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        const indexMatch = line.match(/^\s*(\d+)\.?\s*$/);
        if (indexMatch) {
            if (currentPatient) {
                patients.push(currentPatient);
            }
            currentPatient = {
                index: indexMatch[1],
                name: `Patient #${indexMatch[1]}`,
                fileNumber: '',
                age: 50,
                physician: 'Unassigned',
                diagnosis: '',
                notes: '',
                tasks: []
            };
            hasPhysician = false;
            continue;
        }

        if (!currentPatient) {
            continue;
        }

        const mrnMatch = line.match(/^\s*(\d{5,8})\s*$/);
        if (!currentPatient.fileNumber && mrnMatch) {
            currentPatient.fileNumber = mrnMatch[1];
            currentPatient.name = `Patient #${mrnMatch[1]}`;
            continue;
        }

        const physicianMatch = line.match(/^Dr\.?\s*\w+/i) || line.toLowerCase().startsWith('dr ');
        if (physicianMatch) {
            currentPatient.physician = line;
            hasPhysician = true;
            continue;
        }

        const ageMatch = line.match(/A\s*(\d+)\s*(?:y\/o|year|yr)/i) || line.match(/A(\d+)\s*(?:y\/o|year|yr)/i);
        if (ageMatch) {
            currentPatient.age = parseInt(ageMatch[1], 10);
        }

        if (!hasPhysician) {
            if (currentPatient.diagnosis) currentPatient.diagnosis += ' ';
            currentPatient.diagnosis += line;
        } else {
            if (currentPatient.notes) currentPatient.notes += '\n';
            currentPatient.notes += line;
        }
    }

    if (currentPatient) {
        patients.push(currentPatient);
    }

    return patients;
}

function parseTumorBoardWordHtml(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const table = tempDiv.querySelector('table');
    if (!table) {
        const text = tempDiv.innerText || tempDiv.textContent || '';
        return parseTumorBoardWordText(text);
    }

    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) {
        const text = tempDiv.innerText || tempDiv.textContent || '';
        return parseTumorBoardWordText(text);
    }

    const patients = [];
    let hasHeader = false;
    const firstRowCells = rows[0].querySelectorAll('td, th');
    const firstRowText = Array.from(firstRowCells).map(c => c.textContent.trim().toLowerCase());
    if (firstRowText.includes('#') || firstRowText.includes('mrn') || firstRowText.includes('history') || firstRowText.includes('physician') || firstRowText.includes('points') || firstRowText.includes('discussion')) {
        hasHeader = true;
    }

    let colIndex = 0;
    let colMrn = 1;
    let colDiagnosis = 2;
    let colPhysician = 3;
    let colNotes = 4;

    if (hasHeader) {
        firstRowText.forEach((colText, idx) => {
            if (colText.includes('#') || colText === 'no' || colText === 'index') {
                colIndex = idx;
            } else if (colText.includes('mrn') || colText.includes('file')) {
                colMrn = idx;
            } else if (colText.includes('history') || colText.includes('brief') || colText.includes('diagnosis')) {
                colDiagnosis = idx;
            } else if (colText.includes('physician') || colText.includes('doctor') || colText.includes('responsible') || colText === 'dr') {
                colPhysician = idx;
            } else if (colText.includes('discussion') || colText.includes('points') || colText.includes('notes') || colText.includes('follow')) {
                colNotes = idx;
            }
        });
    }

    const startIdx = hasHeader ? 1 : 0;

    for (let r = startIdx; r < rows.length; r++) {
        const cells = rows[r].querySelectorAll('td');
        if (cells.length === 0) continue;

        const cellTexts = Array.from(cells).map(c => {
            const d = document.createElement('div');
            d.innerHTML = c.innerHTML.trim()
                .replace(/<p>/g, '')
                .replace(/<\/p>/g, '\n')
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/&nbsp;/g, ' ')
                .trim();
            return d.innerText || d.textContent || '';
        });

        if (cellTexts.length < 2) continue;

        let index = '';
        if (cellTexts[colIndex]) {
            index = cellTexts[colIndex].replace(/\.$/, '').trim();
        } else {
            index = String(r);
        }
        if (isNaN(parseInt(index))) continue;

        let fileNumber = '';
        let diagnosis = '';
        let physician = 'Unassigned';
        let notes = '';

        if (cellTexts.length > Math.max(colMrn, colDiagnosis, colPhysician, colNotes)) {
            fileNumber = cellTexts[colMrn].trim();
            diagnosis = cellTexts[colDiagnosis].trim();
            physician = cellTexts[colPhysician].trim() || 'Unassigned';
            notes = cellTexts[colNotes].trim();
        } else {
            // Heuristic matching fallback
            for (let c = 0; c < cellTexts.length; c++) {
                if (c === colIndex) continue;
                const text = cellTexts[c].trim();
                if (!text) continue;

                if (/^\d{5,8}$/.test(text)) {
                    fileNumber = text;
                } else if (/^Dr\.?\s*\w+/i.test(text) || text.toLowerCase().startsWith('dr ')) {
                    physician = text;
                } else if (/A\s*\d+\s*(?:y\/o|year|yr)/i.test(text) || text.toLowerCase().includes('patient') || text.toLowerCase().includes('female') || text.toLowerCase().includes('male')) {
                    diagnosis = text;
                } else {
                    if (notes) notes += '\n';
                    notes += text;
                }
            }
        }

        // Fallback diagnosis if empty
        if (!diagnosis && cellTexts[colDiagnosis]) {
            diagnosis = cellTexts[colDiagnosis].trim();
        }
        if (!diagnosis) {
            let longest = '';
            cellTexts.forEach(c => { if (c.length > longest.length) longest = c; });
            diagnosis = longest || 'Oncology follow-up';
        }

        let age = 50;
        const ageMatch = diagnosis.match(/A\s*(\d+)\s*(?:y\/o|year|yr)/i) || diagnosis.match(/A(\d+)\s*(?:y\/o|year|yr)/i);
        if (ageMatch) {
            age = parseInt(ageMatch[1], 10);
        }

        const fallbackName = fileNumber ? `Patient #${fileNumber}` : `Patient #${index}`;

        patients.push({
            index: index,
            name: fallbackName,
            fileNumber: fileNumber,
            age: age,
            physician: physician || 'Unassigned',
            diagnosis: diagnosis,
            notes: notes,
            tasks: []
        });
    }

    if (patients.length === 0) {
        const text = tempDiv.innerText || tempDiv.textContent || '';
        return parseTumorBoardWordText(text);
    }

    return patients;
}

function renderWordImportPreview(patients) {
    const previewSection = document.getElementById('word-preview-section');
    const tbody = document.getElementById('table-word-preview-body');
    const countBadge = document.getElementById('word-detected-count');
    const importBtn = document.getElementById('btn-submit-word-import');

    tbody.innerHTML = '';

    if (patients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-light); padding:20px;">No patients detected in the input.</td></tr>`;
        previewSection.style.display = 'block';
        countBadge.innerText = '0';
        importBtn.disabled = true;
        return;
    }

    patients.forEach((patient, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="checkbox" class="word-import-check" checked style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td>
                <input type="text" class="form-control word-import-name" value="${patient.name}" placeholder="Patient Full Name" required style="font-size: 0.85rem; padding: 4px 8px;">
            </td>
            <td>
                <input type="text" class="form-control word-import-file" value="${patient.fileNumber}" placeholder="MRN" style="font-size: 0.85rem; padding: 4px 8px; font-family: monospace;">
            </td>
            <td>
                <input type="number" class="form-control word-import-age" value="${patient.age}" style="font-size: 0.85rem; padding: 4px 8px; width: 65px;">
            </td>
            <td>
                <input type="text" class="form-control word-import-physician" value="${patient.physician}" style="font-size: 0.85rem; padding: 4px 8px;">
            </td>
            <td>
                <textarea class="form-control word-import-diagnosis" style="font-size: 0.8rem; padding: 4px 8px; min-height: 40px; resize: vertical;">${patient.diagnosis}</textarea>
                <textarea class="word-import-notes" style="display:none;">${patient.notes}</textarea>
            </td>
        `;
        tbody.appendChild(tr);
    });

    previewSection.style.display = 'block';
    countBadge.innerText = patients.length;
    importBtn.disabled = false;
}

function submitWordImport() {
    const rows = document.querySelectorAll('#table-word-preview-body tr');
    let importCount = 0;
    let duplicateCount = 0;

    rows.forEach(row => {
        const checkbox = row.querySelector('.word-import-check');
        if (!checkbox || !checkbox.checked) return;

        const name = row.querySelector('.word-import-name').value.trim();
        const fileNumber = row.querySelector('.word-import-file').value.trim();
        const age = parseInt(row.querySelector('.word-import-age').value) || 50;
        const physician = row.querySelector('.word-import-physician').value.trim() || 'Unassigned';
        const diagnosis = row.querySelector('.word-import-diagnosis').value.trim();
        const notes = row.querySelector('.word-import-notes').value.trim();

        if (!name) {
            return;
        }

        const isDup = fileNumber ? tumorBoardList.some(p => p.fileNumber === fileNumber) : false;
        if (isDup) {
            duplicateCount++;
            return;
        }

        const patient = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            name,
            fileNumber,
            age,
            physician,
            diagnosis,
            notes,
            tasks: []
        };

        tumorBoardList.push(patient);
        importCount++;
    });

    saveToLocalStorage();
    renderTumorBoardTable();
    closeImportWordModal();
    renderDashboard();

    let msg = `Successfully imported ${importCount} patients.`;
    if (duplicateCount > 0) {
        msg += ` (${duplicateCount} patients with duplicate MRNs were skipped).`;
    }
    alert(msg);
}

let currentProfilePatientId = null;

function openPatientProfile(patientId) {
    currentProfilePatientId = patientId;
    const patient = tumorBoardList.find(p => p.id === patientId);
    if (!patient) return;

    document.getElementById('prof-name').value = patient.name;
    document.getElementById('prof-file').value = patient.fileNumber;
    document.getElementById('prof-age').value = patient.age;
    document.getElementById('prof-physician').value = patient.physician;
    document.getElementById('prof-diagnosis').value = patient.diagnosis;
    document.getElementById('prof-notes').value = patient.notes || '';

    renderProfileTasks(patient);

    document.getElementById('prof-add-task-type').value = 'referral_followup';
    document.getElementById('prof-add-task-notes').value = '';
    toggleProfileTaskFields();

    document.getElementById('modal-patient-profile').classList.add('active');
}

function closePatientProfileModal() {
    document.getElementById('modal-patient-profile').classList.remove('active');
    currentProfilePatientId = null;
}

function saveProfileDemographics(event) {
    if (event) event.preventDefault();
    if (!currentProfilePatientId) return;

    const patientIdx = tumorBoardList.findIndex(p => p.id === currentProfilePatientId);
    if (patientIdx === -1) return;

    const name = document.getElementById('prof-name').value.trim();
    const fileNumber = document.getElementById('prof-file').value.trim();
    const age = parseInt(document.getElementById('prof-age').value) || 50;
    const physician = document.getElementById('prof-physician').value.trim();
    const diagnosis = document.getElementById('prof-diagnosis').value.trim();
    const notes = document.getElementById('prof-notes').value.trim();

    if (!name || !physician || !diagnosis) {
        alert("Please fill in all required fields marked with *");
        return;
    }

    if (fileNumber) {
        const isDup = tumorBoardList.some((p, idx) => idx !== patientIdx && p.fileNumber === fileNumber);
        if (isDup) {
            alert("A patient with this File Number (MRN) already exists.");
            return;
        }
    }

    tumorBoardList[patientIdx].name = name;
    tumorBoardList[patientIdx].fileNumber = fileNumber;
    tumorBoardList[patientIdx].age = age;
    tumorBoardList[patientIdx].physician = physician;
    tumorBoardList[patientIdx].diagnosis = diagnosis;
    tumorBoardList[patientIdx].notes = notes;

    saveToLocalStorage();
    renderTumorBoardTable();
    alert("Demographics updated successfully.");
}

function toggleProfileTaskFields() {
    const typeSelect = document.getElementById('prof-add-task-type');
    const clinicFields = document.getElementById('prof-task-clinic-fields');
    const otherFields = document.getElementById('prof-task-other-fields');
    
    if (!typeSelect) return;
    const val = typeSelect.value;
    
    if (val === 'clinic_booking') {
        clinicFields.style.display = 'grid';
        otherFields.style.display = 'none';
        
        const dateInput = document.getElementById('prof-task-clinic-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    } else if (val === 'other') {
        clinicFields.style.display = 'none';
        otherFields.style.display = 'block';
    } else {
        clinicFields.style.display = 'none';
        otherFields.style.display = 'none';
    }
}

function addProfileTask() {
    if (!currentProfilePatientId) return;

    const patient = tumorBoardList.find(p => p.id === currentProfilePatientId);
    if (!patient) return;

    const typeSelect = document.getElementById('prof-add-task-type');
    const notesInput = document.getElementById('prof-add-task-notes');
    
    if (!typeSelect) return;
    const type = typeSelect.value;
    const notes = notesInput.value.trim();

    let title = '';
    let details = '';

    if (type === 'referral_followup') {
        title = 'متابعة تحويلة';
    } else if (type === 'referral_submit') {
        title = 'تقديم تحويلة';
    } else if (type === 'permit_submit') {
        title = 'تقديم تصريح';
    } else if (type === 'clinic_booking') {
        const clinicType = document.getElementById('prof-task-clinic-type').value.trim() || 'General';
        const clinicDate = document.getElementById('prof-task-clinic-date').value;
        
        title = `حجز عيادة - ${clinicType}`;
        details = clinicDate ? `Scheduled: ${formatDateDisplay(clinicDate)}` : 'No date scheduled';
    } else if (type === 'imaging_request') {
        title = 'طلب صور طبية';
    } else if (type === 'lab_request') {
        title = 'طلب فحوصات طبية';
    } else if (type === 'other') {
        const otherTitle = document.getElementById('prof-task-other-title').value.trim() || 'متابعة أخرى';
        title = otherTitle;
    }

    const task = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        type: type,
        title: title,
        details: details,
        notes: notes,
        status: 'pending'
    };

    patient.tasks.push(task);
    saveToLocalStorage();
    renderProfileTasks(patient);
    renderTumorBoardTable();

    notesInput.value = '';
    if (type === 'clinic_booking') {
        document.getElementById('prof-task-clinic-type').value = '';
        document.getElementById('prof-task-clinic-date').value = new Date().toISOString().split('T')[0];
    } else if (type === 'other') {
        document.getElementById('prof-task-other-title').value = '';
    }
}

function deleteProfileTask(taskId) {
    if (!currentProfilePatientId) return;
    const patient = tumorBoardList.find(p => p.id === currentProfilePatientId);
    if (!patient) return;

    if (confirm("Are you sure you want to delete this task?")) {
        patient.tasks = patient.tasks.filter(t => t.id !== taskId);
        saveToLocalStorage();
        renderProfileTasks(patient);
        renderTumorBoardTable();
    }
}

function toggleProfileTaskStatus(taskId) {
    if (!currentProfilePatientId) return;
    const patient = tumorBoardList.find(p => p.id === currentProfilePatientId);
    if (!patient) return;

    const task = patient.tasks.find(t => t.id === taskId);
    if (task) {
        task.status = task.status === 'completed' ? 'pending' : 'completed';
        saveToLocalStorage();
        renderProfileTasks(patient);
        renderTumorBoardTable();
    }
}

function renderProfileTasks(patient) {
    const listContainer = document.getElementById('prof-tasks-list');
    const countBadge = document.getElementById('prof-tasks-count');
    
    listContainer.innerHTML = '';
    const total = patient.tasks.length;
    countBadge.innerText = `${total} Task${total === 1 ? '' : 's'}`;

    if (total === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-light); padding: 20px; font-size: 0.85rem;">
                No follow-ups added yet. Add a task using the form below.
            </div>
        `;
        return;
    }

    patient.tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.status}`;
        
        const detailsHtml = task.details ? `<div class="task-item-details">${task.details}</div>` : '';
        const notesHtml = task.notes ? `<div class="task-item-notes"><strong>Note:</strong> ${task.notes}</div>` : '';
        
        item.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: flex-start; width: 100%;">
                <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                    onchange="toggleProfileTaskStatus('${task.id}')"
                    style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--success); margin-top: 2px;">
                <div class="task-item-content">
                    <span class="task-item-title">${task.title}</span>
                    ${detailsHtml}
                    ${notesHtml}
                </div>
                <button class="action-btn delete" onclick="deleteProfileTask('${task.id}')" title="Delete Task" style="align-self: center;">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function openPrintProfileSettingsModal() {
    if (!currentProfilePatientId) return;
    const patient = tumorBoardList.find(p => p.id === currentProfilePatientId);
    if (!patient) return;

    const container = document.getElementById('print-profile-tasks-container');
    container.innerHTML = '';

    if (patient.tasks.length === 0) {
        container.innerHTML = `<span style="color: var(--text-light); text-align: center; font-size: 0.85rem;">No tasks to select</span>`;
        document.getElementById('print-prof-select-all').checked = false;
        document.getElementById('print-prof-select-all').disabled = true;
    } else {
        document.getElementById('print-prof-select-all').checked = true;
        document.getElementById('print-prof-select-all').disabled = false;
        
        patient.tasks.forEach(task => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '10px';
            label.style.fontSize = '0.9rem';
            label.style.cursor = 'pointer';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = task.id;
            chk.className = 'print-profile-task-checkbox';
            chk.checked = true;
            chk.style.width = '16px';
            chk.style.height = '16px';
            chk.style.accentColor = 'var(--primary)';
            
            label.appendChild(chk);
            
            let statusText = task.status === 'completed' ? '(Completed)' : '(Pending)';
            label.appendChild(document.createTextNode(`${task.title} - ${statusText}`));
            container.appendChild(label);
        });
    }

    document.getElementById('modal-print-profile-settings').classList.add('active');
}

function closePrintProfileSettingsModal() {
    document.getElementById('modal-print-profile-settings').classList.remove('active');
}

function toggleSelectAllPrintProfile(checked) {
    document.querySelectorAll('.print-profile-task-checkbox').forEach(chk => {
        chk.checked = checked;
    });
}

function submitPrintPatientProfile() {
    if (!currentProfilePatientId) return;

    const checkedBoxes = document.querySelectorAll('.print-profile-task-checkbox:checked');
    const selectedTaskIds = Array.from(checkedBoxes).map(chk => chk.value);

    if (selectedTaskIds.length === 0) {
        alert("Please select at least one task to print.");
        return;
    }

    closePrintProfileSettingsModal();
    closePatientProfileModal();
    
    generateAndPrintPatientProfile(currentProfilePatientId, selectedTaskIds);
}

function generateAndPrintPatientProfile(patientId, selectedTaskIds) {
    const patient = tumorBoardList.find(p => p.id === patientId);
    if (!patient) return;

    const printContainer = document.getElementById('print-container');
    printContainer.innerHTML = '';

    const today = new Date();
    const formattedPrintDate = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const tasksToPrint = patient.tasks.filter(t => selectedTaskIds.includes(t.id));

    let rowsHtml = '';
    tasksToPrint.forEach((task, idx) => {
        const statusText = task.status === 'completed' ? 'Completed' : 'Pending';
        const detailsStr = task.details ? `<br><small style="color:#475569;">${task.details}</small>` : '';
        rowsHtml += `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-weight: 700;">${task.title}${detailsStr}</td>
                <td style="text-align: center; font-weight: 600;">${statusText}</td>
                <td>${task.notes || '-'}</td>
            </tr>
        `;
    });

    const printHtml = `
        <div class="print-page-section print-profile-report">
            <div class="print-report-header" style="align-items: center; border-bottom: 2px solid #0d9488; margin-bottom: 20px; padding-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="logo.png" alt="Augusta Victoria Hospital Logo" style="height: 60px; object-fit: contain;">
                    <div class="hospital-info">
                        <h2 style="color: #0f172a; margin: 0; font-size: 18pt; font-weight: 800;">Augusta Victoria Hospital</h2>
                        <p style="color: #0d9488; font-weight: 700; margin: 2px 0 0 0; font-size: 10pt; text-transform: uppercase;">Tumor Board Patient Follow-up Report</p>
                    </div>
                </div>
                <div class="report-meta" style="text-align: right;">
                    <h3 style="color: #0f172a; font-size: 12pt; margin: 0;">Clinical Care Plan</h3>
                    <p style="color: #475569; font-size: 8.5pt; margin: 2px 0 0 0;">Printed: ${formattedPrintDate}</p>
                </div>
            </div>

            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; background-color: #f8fafc; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; color: #0f172a; font-size: 11pt; text-transform: uppercase; font-weight: 700;">Patient Demographics</h4>
                <table style="width: 100%; font-size: 9.5pt; border-collapse: collapse;">
                    <tr>
                        <td style="width: 15%; padding: 4px 0; font-weight: 700; border: none !important;">Patient Name:</td>
                        <td style="width: 35%; padding: 4px 0; border: none !important;">${patient.name}</td>
                        <td style="width: 15%; padding: 4px 0; font-weight: 700; border: none !important;">File No. (MRN):</td>
                        <td style="width: 35%; padding: 4px 0; border: none !important;"><code>${patient.fileNumber}</code></td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-weight: 700; border: none !important;">Age:</td>
                        <td style="padding: 4px 0; border: none !important;">${patient.age} years</td>
                        <td style="padding: 4px 0; font-weight: 700; border: none !important;">Physician:</td>
                        <td style="padding: 4px 0; border: none !important;">${patient.physician}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0 4px 0; font-weight: 700; vertical-align: top; border: none !important;">Diagnosis:</td>
                        <td colspan="3" style="padding: 6px 0 4px 0; border: none !important; line-height: 1.4;">${patient.diagnosis}</td>
                    </tr>
                    ${patient.notes ? `
                    <tr>
                        <td style="padding: 6px 0 0 0; font-weight: 700; vertical-align: top; border: none !important;">Discussion Notes:</td>
                        <td colspan="3" style="padding: 6px 0 0 0; border: none !important; line-height: 1.4; color: #334155; font-style: italic;">${patient.notes}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>

            <h4 style="margin: 20px 0 10px 0; color: #0f172a; font-size: 11pt; text-transform: uppercase; font-weight: 700;">Follow-up Checklist</h4>
            <table class="print-table" style="margin-top: 5px !important;">
                <thead>
                    <tr>
                        <th style="width: 5%; text-align: center; background-color: #f1f5f9; border: 1px solid #94a3b8; font-weight: 700;">#</th>
                        <th style="width: 35%; background-color: #f1f5f9; border: 1px solid #94a3b8; font-weight: 700;">Task / Follow-up</th>
                        <th style="width: 25%; text-align: center; background-color: #f1f5f9; border: 1px solid #94a3b8; font-weight: 700;">Status</th>
                        <th style="width: 35%; background-color: #f1f5f9; border: 1px solid #94a3b8; font-weight: 700;">Specific Task Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="print-footer-signature" style="margin-top: 50px;">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <span class="signature-title">Coordinator Signature</span>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <span class="signature-title">Clinical Oncology Dept</span>
                </div>
            </div>
        </div>
    `;

    printContainer.innerHTML = printHtml;
    printContainer.className = 'print-portrait-report';
    document.body.className = 'print-portrait-mode';

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            document.body.className = localStorage.getItem('medsched_dark_mode') === 'true' ? 'dark-mode' : '';
        }, 100);
    }, 250);
}
