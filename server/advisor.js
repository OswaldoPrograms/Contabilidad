const database = require('./database');
const time = require('./time');

const ALERTS_TABLE = `CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  fingerprint TEXT NOT NULL UNIQUE,
  severity TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  first_detected_at TEXT NOT NULL,
  last_shown_at TEXT,
  dismissed INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0
)`;
const severityRank = { high: 0, medium: 1, low: 2 };
const importantTags = new Set(['#entrega', '#examen', '#pago', '#cita', '#reunion']);

function parseDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null; }
function isNear(task, today) { const date = parseDate(task.date); if (!date) return false; const difference = time.dateDifference(date, today); return difference >= 0 && difference <= 3; }
function relevantTask(task) { return task.priority === 'high' || task.tags.some(tag => importantTags.has(tag)); }
function severityFor(task, today) { const date = parseDate(task.date); const difference = date ? time.dateDifference(date, today) : 3; if (difference < 0 || (difference <= 1 && (task.priority === 'high' || task.tags.some(tag => importantTags.has(tag))))) return 'high'; if (difference <= 1) return 'medium'; return 'low'; }
function alertPayload(candidate) { return { type: candidate.type, severity: candidate.severity, taskId: candidate.taskId || null, personId: candidate.personId || null, title: candidate.title || null, reason: candidate.reason, relatedPendingTasks: candidate.relatedPendingTasks || 0 }; }
function sharedContextTags(task, other) { const excluded = new Set(['#entrega', '#tarea', '#pendiente']); return task.tags.filter(tag => excluded.has(tag) ? false : other.tags.includes(tag)); }

async function ensureTable() { await database.run(ALERTS_TABLE); }
async function analyze() {
  await ensureTable();
  const now = time.getNow();
  const today = time.getToday(now);
  const tasks = await database.findTasks();
  const candidates = [];
  const pending = tasks.filter(task => !task.completed);

  for (const task of pending) {
    const date = parseDate(task.date);
    if (date && time.dateDifference(date, today) < 0) {
      candidates.push({ type: 'overdue', severity: 'high', entityType: 'task', taskId: task.id, title: task.title, reason: 'La tarea esta vencida.' });
    }
    if (date && isNear(task, today) && relevantTask(task)) {
      const days = time.dateDifference(date, today);
      candidates.push({ type: 'upcoming_deadline', severity: severityFor(task, today), entityType: 'task', taskId: task.id, title: task.title, reason: days === 0 ? 'La tarea es para hoy.' : days === 1 ? 'La tarea es para manana.' : 'La tarea es proxima.' });
    }
    if (date && isNear(task, today) && (task.type === 'appointment' || task.type === 'event' || task.tags.includes('#cita') || task.tags.includes('#reunion')) && !task.time) {
      candidates.push({ type: 'missing_time', severity: 'medium', entityType: 'task', taskId: task.id, title: task.title, reason: 'La cita o evento proximo no tiene hora registrada.' });
    }
    if (date && isNear(task, today) && task.tags.includes('#llamada')) {
      const missingPhone = (task.people || []).find(person => !person.phone);
      if (missingPhone) candidates.push({ type: 'missing_contact_phone', severity: 'medium', entityType: 'person', entityId: missingPhone.id, taskId: task.id, personId: missingPhone.id, title: task.title, reason: `No hay telefono registrado para ${missingPhone.fullName}.` });
    }
    if (date && isNear(task, today) && task.tags.includes('#pago')) {
      candidates.push({ type: 'upcoming_payment', severity: severityFor(task, today), entityType: 'task', taskId: task.id, title: task.title, reason: 'Tienes un pago proximo.' });
    }
  }

  const byDate = new Map();
  pending.filter(task => task.date).forEach(task => { if (!byDate.has(task.date)) byDate.set(task.date, []); byDate.get(task.date).push(task); });
  for (const [date, dayTasks] of byDate) {
    const highCount = dayTasks.filter(task => task.priority === 'high').length;
    if (dayTasks.length >= 4 || highCount >= 2) candidates.push({ type: 'day_overload', severity: highCount >= 2 ? 'high' : 'medium', entityType: 'date', title: date, reason: `Tienes ${dayTasks.length} tareas pendientes ese dia.`, relatedPendingTasks: dayTasks.length });
  }

  for (const task of pending.filter(item => item.tags.includes('#entrega'))) {
    const related = pending.filter(other => other.id !== task.id && sharedContextTags(task, other).length > 0);
    if (related.length) candidates.push({ type: 'related_pending_work', severity: severityFor(task, today), entityType: 'task', taskId: task.id, title: task.title, reason: `La entrega tiene ${related.length} tarea${related.length === 1 ? '' : 's'} relacionada${related.length === 1 ? '' : 's'} pendiente${related.length === 1 ? '' : 's'}.`, relatedPendingTasks: related.length });
  }

  const unique = new Map();
  candidates.forEach(candidate => {
    const datePart = candidate.taskId ? `task:${candidate.taskId}` : candidate.title;
    const fingerprint = `${candidate.type}:${datePart}:${candidate.relatedPendingTasks || ''}:${candidate.personId || ''}`;
    unique.set(fingerprint, { ...candidate, fingerprint });
  });
  const current = [...unique.values()];
  const timestamp = now.toISOString();
  for (const candidate of current) {
    const payload = JSON.stringify(alertPayload(candidate));
    await database.run(`INSERT INTO alerts (type, entity_type, entity_id, fingerprint, severity, payload, first_detected_at, resolved, dismissed) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0) ON CONFLICT(fingerprint) DO UPDATE SET severity = excluded.severity, payload = excluded.payload, dismissed = CASE WHEN alerts.resolved = 1 THEN 0 ELSE alerts.dismissed END, resolved = 0`, [candidate.type, candidate.entityType, candidate.taskId || candidate.entityId || null, candidate.fingerprint, candidate.severity, payload, timestamp]);
  }
  const fingerprints = current.map(candidate => candidate.fingerprint);
  if (fingerprints.length) await database.run(`UPDATE alerts SET resolved = 1 WHERE fingerprint NOT IN (${fingerprints.map(() => '?').join(',')})`, fingerprints);
  else await database.run('UPDATE alerts SET resolved = 1');
  const rows = await database.all('SELECT id, type, severity, payload, first_detected_at AS firstDetectedAt, last_shown_at AS lastShownAt FROM alerts WHERE resolved = 0 AND dismissed = 0 ORDER BY CASE severity WHEN "high" THEN 0 WHEN "medium" THEN 1 ELSE 2 END, id DESC');
  return rows.map(row => ({ ...JSON.parse(row.payload), id: row.id, type: row.type, severity: row.severity, firstDetectedAt: row.firstDetectedAt, lastShownAt: row.lastShownAt })).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

async function dismiss(id) { await ensureTable(); await database.run('UPDATE alerts SET dismissed = 1 WHERE id = ?', [id]); return analyze(); }

module.exports = { analyze, dismiss };
