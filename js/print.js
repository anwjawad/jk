// Printable reports and Word (.doc) export, sharing one layout.
import { esc, html, fmtDate, todayISO, downloadFile } from './util.js';
import { settings } from './settings.js';
import { modal, toast, icon } from './ui.js';

const cell = (v) => esc(v ?? '').replace(/\n/g, '<br>');

const CSS = (landscape, word) => `
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 11mm; }
  * { box-sizing: border-box; }
  body { font-family: "Plus Jakarta Sans", "Segoe UI", Calibri, Arial, sans-serif; color: #0f172a; margin: ${word ? '0.5in' : '0'}; font-size: 10.5pt; }
  .hdr { display: table; width: 100%; border-bottom: 2.5px solid #0F766E; padding-bottom: 8px; margin-bottom: 12px; }
  .hdr > div { display: table-cell; vertical-align: middle; }
  .hdr .logo img { height: 52px; }
  .hdr .org { font-size: 9pt; color: #334155; padding-left: 10px; }
  .hdr .org b { display: block; font-size: 11pt; color: #0f172a; }
  .hdr .ttl { text-align: center; }
  .hdr .ttl h1 { margin: 0; font-size: 16pt; letter-spacing: .3px; text-transform: uppercase; }
  .hdr .ttl p { margin: 2px 0 0; color: #0F766E; font-weight: 700; font-size: 9.5pt; }
  .hdr .when { text-align: right; font-size: 9pt; color: #475569; }
  .hdr .when b { display: block; font-size: 12pt; color: #0f172a; }
  .summary { margin: 0 0 10px; font-size: 9.5pt; color: #334155; }
  .summary span { display: inline-block; margin-right: 18px; }
  .summary b { font-size: 12pt; color: #0f172a; margin-right: 3px; }
  h2 { font-size: 11.5pt; margin: 16px 0 6px; padding: 5px 9px; background: #F0FDFA; border-left: 4px solid #0F766E; }
  h2 small { float: right; font-weight: 600; color: #0F766E; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #94a3b8; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #E2E8F0; font-size: 9pt; text-transform: uppercase; letter-spacing: .2px; }
  td { font-size: 9.8pt; }
  tr { page-break-inside: avoid; }
  td.n, th.n { text-align: center; width: 26px; color: #475569; }
  td.c, th.c { text-align: center; }
  .muted { color: #64748b; font-style: italic; text-align: center; }
  .sig { margin-top: 36px; width: 220px; text-align: center; font-size: 9.5pt; }
  .sig .name { font-weight: 700; min-height: 18px; }
  .sig .line { border-bottom: 1px solid #000; margin: 4px 0; }
  .sig .role { color: #475569; font-weight: 600; }
  .foot { margin-top: 18px; font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 5px; }
  .pb { page-break-after: always; }
`;

function sectionHTML(s) {
  const cols = s.columns;
  const body = s.rows.length
    ? s.rows.map((r, i) => `<tr><td class="n">${i + 1}</td>${r.map((v, j) => `<td class="${cols[j]?.align || ''}">${cell(v)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length + 1}" class="muted">${esc(s.empty || 'No patients.')}</td></tr>`;
  return `
    ${s.heading ? `<h2>${esc(s.heading)}${s.badge ? `<small>${esc(s.badge)}</small>` : ''}</h2>` : ''}
    <table><thead><tr><th class="n">#</th>${cols.map((c) => `<th class="${c.align || ''}"${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${body}</tbody></table>`;
}

function docHTML({ title, subtitle = '', when = '', whenSub = '', summary = [], sections, preparedBy = '', signature = true, landscape = false, pageBreaks = false }, { word = false, logo = '' } = {}) {
  const hospital = settings.get('hospital') || '';
  const printed = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const header = `
    <div class="hdr">
      <div class="logo" style="width:28%">${logo ? `<img src="${logo}" alt="${esc(hospital)}">` : `<span class="org"><b>${esc(hospital)}</b></span>`}</div>
      <div class="ttl"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
      <div class="when" style="width:28%"><b>${esc(when || fmtDate(todayISO(), 'full'))}</b>${esc(whenSub)}</div>
    </div>`;
  const sum = summary.length ? `<div class="summary">${summary.map((s) => `<span><b>${esc(s.value)}</b>${esc(s.label)}</span>`).join('')}</div>` : '';
  const secs = sections.map((s, i) => sectionHTML(s) + (pageBreaks && i < sections.length - 1 && !word ? '<div class="pb"></div>' : '')).join('');
  const sig = signature ? `<div class="sig"><div class="name">${esc(preparedBy) || '&nbsp;'}</div><div class="line"></div><div class="role">Prepared by</div></div>` : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS(landscape, word)}</style></head>
    <body>${header}${sum}${secs}${sig}<div class="foot">Printed ${esc(printed)}${preparedBy ? ` · Prepared by ${esc(preparedBy)}` : ''}</div>
    ${word ? '' : '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>'}</body></html>`;
}

let logoData = null;
async function logoDataURL() {
  if (logoData) return logoData;
  try {
    const blob = await (await fetch('logo.png')).blob();
    logoData = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  } catch { logoData = ''; }
  return logoData;
}

export async function output(doc, action) {
  if (action === 'word') {
    const content = docHTML(doc, { word: true, logo: await logoDataURL() });
    const name = `${doc.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')}-${doc.fileDate || todayISO()}.doc`;
    downloadFile(name, '﻿' + content, 'application/msword');
    toast(`Saved ${name}`);
    return;
  }
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups for this site so the print window can open.', { type: 'error' }); return; }
  w.document.open();
  w.document.write(docHTML(doc, { logo: new URL('logo.png', location.href).href }));
  w.document.close();
}

// Asks who prepared the report, then prints or exports. `extra` adds options above the name.
export async function printDialog(build, { title = 'Print', extra = '', note = '' } = {}) {
  const r = await modal({
    title,
    size: 's',
    body: html`
      ${extra}
      <label class="field"><span>Prepared by</span><input name="preparedBy" value="${settings.get('userName') || ''}" autocomplete="name" placeholder="Your name…"></label>
      ${note ? html`<p class="hint">${note}</p>` : ''}
      <p class="hint">${icon('print', 14)} To save a PDF, choose “Save as PDF” in the print window.</p>`,
    primary: 'Print',
    extraButtons: '<button type="submit" class="btn" value="word">Export Word</button>',
  });
  if (!r) return;
  if (r.preparedBy && !settings.get('userName')) settings.set({ userName: r.preparedBy });
  const doc = await build(r);
  if (!doc) return;
  await output({ ...doc, preparedBy: r.preparedBy }, r._submitter === 'word' ? 'word' : 'print');
}
