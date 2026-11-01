# MedSched — Admission Cards UI Changes Needed

Generated: 2026-06-04

---

## 1. style.css — Spacing (8pt grid fixes)

| Line | Current | Change to |
|------|---------|-----------|
| 859 | `padding: 10px` | `padding: 12px` |
| 867 | `gap: 7px` | `gap: 8px` |
| 935 | `gap: 5px` | `gap: 8px` |
| 951 | `padding: 4px 6px` | `padding: 4px 8px` |
| 961 | `gap: 6px` | `gap: 8px` |
| 966 | `gap: 6px` | `gap: 8px` |
| 972 | `padding: 5px 6px` | `padding: 6px 8px` |

---

## 2. style.css — Typography (font size & weight fixes)

| Line | Selector | Current | Change to |
|------|----------|---------|-----------|
| 902 | `.admission-card-title strong` (patient name) | `font-size: 0.82rem` | `font-size: 0.94rem` (15px) |
| 903 | same | `font-weight: 850` | `font-weight: 800` |
| 911 | `.admission-card-title span` (file · age · date) | `font-size: 0.69rem` | `font-size: 0.75rem` (12px) |
| 912 | same | `font-weight: 700` | `font-weight: 600` |
| 953 | `.admission-card-meta > span` values | `font-size: 0.68rem` | `font-size: 0.75rem` |
| 954 | same | `font-weight: 750` | `font-weight: 600` |
| 981 | `.admission-card-clinical span` etc (labels) | `font-size: 0.58rem` | `font-size: 0.625rem` (10px) |
| 982 | same | `font-weight: 850` | `font-weight: 700` |
| 992 | clinical/grid strong values | `font-weight: 740` | `font-weight: 600` |

---

## 3. style.css — Touch Targets (action buttons)

Lines 922–930. Current: `26×26px` buttons and `22×22px` sync badge.

Replace:
```css
.admission-card-actions .action-btn {
    width: 26px;
    height: 26px;
}
.admission-card-actions .sync-row-badge {
    width: 22px;
    height: 22px;
}
```
With:
```css
.admission-card-actions .action-btn {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.admission-card-actions .sync-row-badge {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
```

---

## 4. style.css — Fix Hardcoded Shadow Colors

Lines 863 and 874. Replace hardcoded `rgba(15, 23, 42, ...)`:
```css
/* Add to :root variables block (around line 8) */
--shadow-card: 0 8px 18px rgba(15, 23, 42, 0.05);
--shadow-card-hover: 0 12px 24px rgba(15, 23, 42, 0.08);

/* Line 863 — replace box-shadow value */
box-shadow: var(--shadow-card);

/* Line 874 — replace box-shadow value */
box-shadow: var(--shadow-card-hover);
```

---

## 5. style.css — Add Triage Left-Border Stripe

Add this new rule after `.admission-card` block (after line 875):
```css
/* Triage urgency left-border stripe */
.admission-card[data-triage="1"] { border-left: 4px solid #ef4444; }
.admission-card[data-triage="2"] { border-left: 4px solid #f97316; }
.admission-card[data-triage="3"] { border-left: 4px solid #f59e0b; }
.admission-card[data-triage="4"] { border-left: 4px solid #10b981; }
.admission-card[data-triage="5"] { border-left: 4px solid #3b82f6; }
```

---

## 6. style.css — Add Orange Badge Class (replace inline style on triage 2)

Add after `.badge-neutral` rule (after line 1031):
```css
.badge-orange { background-color: #ffedd5; color: #ea580c; }
```

---

## 7. style.css — Add prefers-reduced-motion Guard

Line 868. Wrap the transition:
```css
/* Remove transition from .admission-card block, then add: */
@media (prefers-reduced-motion: no-preference) {
    .admission-card {
        transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
    }
}
```

---

## 8. style.css — Progressive Disclosure (collapse/expand)

Add these new rules (anywhere after the admission-card block):
```css
/* Collapsed state — hide detail sections by default */
.admission-card .admission-card-clinical,
.admission-card .admission-card-grid,
.admission-card .admission-card-notes {
    display: none;
}

/* Show when card is expanded */
.admission-card.expanded .admission-card-clinical,
.admission-card.expanded .admission-card-grid,
.admission-card.expanded .admission-card-notes {
    display: grid; /* clinical and grid are already grid */
}
.admission-card.expanded .admission-card-notes {
    display: block;
}

/* Hide notes row when empty */
.admission-card-notes.is-empty {
    display: none !important;
}
```

---

## 9. app.js — Fix Triage 2 Inline Style (line 881)

Current:
```js
case '2': return `<span class="badge badge-danger" style="background-color:#ffedd5; color:#ea580c;">2 - Emergent</span>`;
```
Change to:
```js
case '2': return `<span class="badge badge-orange">2 - Emergent</span>`;
```

---

## 10. app.js — Add data-triage & expanded toggle to cards (lines 931–932)

In `renderAdmissionsTable()`, find the `<article class="admission-card">` line (~932) and change it to:
```js
<article class="admission-card" data-triage="${patient.triageScore}">
```

Then change the click handler on `tr` (line 923) so clicking the card body toggles expand instead of opening edit:
```js
tr.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('.no-print')) {
        return;
    }
    // Toggle expand instead of opening edit immediately
    const card = tr.querySelector('.admission-card');
    card.classList.toggle('expanded');
});
```
(Edit is still reachable via the Edit button in `.admission-card-actions`.)

---

## 11. app.js — Hide Notes Row When Empty (line 965–967)

Current:
```js
<div class="admission-card-notes">
    <span>Notes</span><strong title="${patient.notes || ''}">${patient.notes || '-'}</strong>
</div>
```
Change to:
```js
<div class="admission-card-notes${!patient.notes ? ' is-empty' : ''}">
    <span>Notes</span><strong title="${patient.notes}">${patient.notes}</strong>
</div>
```

---

## 12. index.html — Remove Dead `<thead>` (lines 252–262)

The `<thead>` columns are invisible because every tbody row uses `colspan="7"`. Remove the entire `<thead>` block:
```html
<!-- DELETE THIS ENTIRE BLOCK -->
<thead>
    <tr>
        <th>Patient</th>
        <th>File / Age</th>
        <th>Date / Dept</th>
        <th>Triage</th>
        <th>Physician</th>
        <th>Clinical Snapshot</th>
        <th class="no-print" style="width: 104px;">Actions</th>
    </tr>
</thead>
```

---

## 13. index.html — Add "Expand All / Collapse All" Toggle

In the admissions list-header-bar (around line 234), add a toggle button next to the counter:
```html
<div class="list-title">
    <span>Planned Admissions List</span>
    <span class="list-counter" id="counter-admissions">0</span>
    <button class="btn btn-secondary btn-sm" onclick="toggleAllAdmissionCards()" id="expand-all-btn">Expand All</button>
</div>
```

Then add this function to **app.js** (anywhere before the closing of the file):
```js
function toggleAllAdmissionCards() {
    const cards = document.querySelectorAll('#table-admissions .admission-card');
    const btn = document.getElementById('expand-all-btn');
    const allExpanded = [...cards].every(c => c.classList.contains('expanded'));
    cards.forEach(c => c.classList.toggle('expanded', !allExpanded));
    btn.textContent = allExpanded ? 'Expand All' : 'Collapse All';
}
```

---

## Priority Order

1. **#2 Typography** — font sizes (patient safety: staff must read accurately)
2. **#5 Triage left-border + #9 Fix triage 2 badge** — visual urgency scanning
3. **#8 + #10 Progressive disclosure** — collapse by default, expand on click
4. **#13 Expand All toggle** — power user control
5. **#3 Touch targets** — action button sizes
6. **#1 Spacing** — 8pt grid alignment
7. **#4 + #6 Tokens** — shadow + badge-orange class
8. **#7 prefers-reduced-motion**
9. **#11 Hide empty notes**
10. **#12 Remove dead thead**
