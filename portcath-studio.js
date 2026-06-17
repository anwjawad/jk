// portcath-studio.js — Port Cath Scheduling Studio

// State — loaded/saved by app.js
let portCathSessionConfig = [];   // [{ id, date, isActive, createdAt }]
let portCathActionHistory = [];   // [{ id, patientId, patientName, fileNumber, action, fromDate, toDate, reason, note, timestamp, syncStatus }]

// Studio UI state
let pcStudioYear  = new Date().getFullYear();
let pcStudioMonth = new Date().getMonth();   // 0-indexed

function renderPortCathStudio() {
    const section = document.getElementById('tab-portcath');
    if (!section) return;
    section.innerHTML = `<div class="pcs-placeholder">Port Cath Studio — loading...</div>`;
}
