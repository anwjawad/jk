// Made-up data for demo mode, with dates around today.
import { todayISO, addDays, weekday, dayName, uid } from './util.js';

const NAMES = ['Ahmad Saleh Odeh', 'Mariam Khalil Nasser', 'Yousef Ali Hamdan', 'Rana Issa Qasem', 'Omar Fathi Jaber', 'Lina Samir Haddad', 'Khaled Musa Barghouti', 'Huda Ibrahim Awad', 'Sami Nabil Darwish', 'Noor Adel Zidan', 'Tariq Hasan Shaheen', 'Dina Raed Sabbah', 'Fadi Jamal Mansour', 'Salma Ziad Khoury', 'Bilal Sami Masri', 'Aya Mahmoud Sharif', 'Hani Walid Zaatari', 'Reem Fares Abed', 'Majd Kamal Hijazi', 'Suha Taher Qawasmi'];
const DOCS = ['Dr. Jalal Qawasmi', 'Dr. Hanna Qahoush', 'Dr. Fahed Hanna', 'Dr. Rami Haddad'];

export function demoDB() {
  const t = todayISO();
  const db = { portcath: {}, sessions: {}, history: {}, admissions: {}, followup: {}, tumorboard: {}, clinic: {} };
  const put = (table, rec) => { const id = rec.id || uid(); db[table][id] = { ...rec, id, createdAt: rec.createdAt || new Date().toISOString() }; return db[table][id]; };
  let n = 0;
  const name = () => NAMES[n++ % NAMES.length];
  const file = () => String(100000 + Math.floor(Math.random() * 800000));
  const phone = () => `059${Math.floor(1000000 + Math.random() * 8999999)}`;

  // Session days: every Saturday and Wednesday from 3 weeks ago to 5 weeks ahead.
  const sessions = [];
  for (let i = -21; i <= 35; i++) {
    const d = addDays(t, i);
    if (weekday(d) === 6 || weekday(d) === 3) sessions.push(d);
  }
  for (const d of sessions) put('sessions', { date: d, year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) - 1, dayOfWeek: dayName(d), isActive: true });

  const past = sessions.filter((d) => d < t);
  const future = sessions.filter((d) => d >= t);
  past.forEach((d, i) => {
    for (let k = 0; k < 3; k++) {
      const status = i < past.length - 2 ? (k === 2 && i % 2 ? 'cancelled' : 'done') : 'confirmed';
      put('portcath', { name: name(), fileNumber: file(), date: d, day: dayName(d), weight: String(55 + ((n * 7) % 40)), phone: phone(), notes: k === 0 ? 'FOLFOX' : '', status, doneAt: status === 'done' ? d : '', nextChemoAppt: addDays(d, 10) });
    }
  });
  future.slice(0, 3).forEach((d, i) => {
    for (let k = 0; k < 4 - i; k++) put('portcath', { name: name(), fileNumber: file(), date: d, day: dayName(d), weight: String(60 + k * 4), phone: phone(), notes: k === 1 ? 'Allergic to iodine' : '', status: 'confirmed', nextChemoAppt: addDays(d, 7) });
  });
  for (let k = 0; k < 5; k++) put('portcath', { name: name(), fileNumber: file(), date: '', day: '', weight: String(58 + k * 3), phone: phone(), notes: k === 0 ? 'Needs permit first' : '', status: 'waiting', createdAt: new Date(Date.now() - (k + 2) * 86400000 * 3).toISOString() });

  const depts = ['Treatment room', 'Day care', 'Hospital Admission'];
  for (let i = -1; i <= 3; i++) {
    const d = addDays(t, i);
    for (let k = 0; k < 4; k++) put('admissions', { name: name(), fileNumber: file(), age: String(35 + ((n * 3) % 45)), triageScore: String(1 + ((n + k) % 5)), primaryPhysician: DOCS[(n + k) % DOCS.length], placeOfReferral: k % 3 ? 'Home' : 'Hospital', modeOfTransportation: ['Private Car', 'Taxi', 'Ambulance'][k % 3], performanceStatus: ['Walking', 'Wheelchair', 'Bedridden'][k % 3], admissionDepartment: depts[k % 3], date: d, summary: 'Ca colon, cycle 4 of FOLFOX', causeOfAdmission: k % 2 ? 'Chemotherapy' : 'Blood transfusion', notes: '' });
  }
  const tasks = ['Call about CT result', 'Remind of lab tests tomorrow', 'Confirm permit renewal', 'WhatsApp the referral copy'];
  for (let i = -2; i <= 1; i++) {
    const d = addDays(t, i);
    for (let k = 0; k < 4; k++) put('followup', { name: name(), phone: phone(), fileNumber: file(), date: d, task: tasks[k], taskResult: i < 0 && k < 3 ? 'Done' : '' });
  }
  for (let k = 0; k < 6; k++) {
    put('tumorboard', {
      name: name(), fileNumber: file(), age: String(40 + k * 5), physician: DOCS[k % DOCS.length], diagnosis: `A ${40 + k * 5} y/o patient with metastatic breast cancer, discussed for next line of therapy.`, notes: 'Repeat PET-CT then re-discuss.',
      tasks: k === 5 ? [] : [
        { id: uid(), type: 'referral_submit', title: 'تقديم تحويلة', details: '', notes: '', status: k % 2 ? 'completed' : 'pending' },
        { id: uid(), type: 'imaging_request', title: 'طلب صور طبية', details: '', notes: 'PET-CT', status: 'pending' },
      ],
    });
  }
  for (let i = -3; i <= 10; i++) {
    const d = addDays(t, i);
    if (weekday(d) === 5) continue;
    for (let k = 0; k < 3; k++) put('clinic', { name: name(), fileNumber: file(), age: String(30 + k * 11), date: d, primaryPhysician: DOCS[(i + k + 10) % DOCS.length].replace('Dr. ', ''), case: 'Follow-up', causeOfAdmission: k ? 'Review labs' : 'New case', note: '' });
  }
  return db;
}
