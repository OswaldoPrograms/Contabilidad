const DEFAULT_TIMEZONE = 'America/Mexico_City';
const TIMEZONE = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;

function validateTimezone(timezone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return timezone; } catch { return DEFAULT_TIMEZONE; }
}
const APP_TIMEZONE = validateTimezone(TIMEZONE);
const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

function getNow() { return new Date(); }
function getLocalParts(date = getNow()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}
function getToday(date = getNow()) { const parts = getLocalParts(date); return `${parts.year}-${parts.month}-${parts.day}`; }
function toLocalDate(date = getNow()) { return getToday(date); }
function toLocalDateTime(date = getNow()) { const parts = getLocalParts(date); return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`; }
function parseLocalDateTime(value) {
  const match = dateTimePattern.exec(String(value || ''));
  if (!match) throw new Error('dateTime debe tener formato YYYY-MM-DDTHH:MM en la zona horaria de la aplicación');
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let guess = target;
  for (let index = 0; index < 4; index += 1) {
    const parts = getLocalParts(new Date(guess));
    const actual = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess += target - actual;
  }
  return new Date(guess);
}
function addMinutes(date, minutes) { return new Date(date.getTime() + Number(minutes) * 60000); }
function localDateTimeFromTask(task) { return task?.date && task?.time ? parseLocalDateTime(`${task.date}T${task.time}`) : null; }
function addLocalDays(dateValue, days) { const [year, month, day] = String(dateValue).split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day + Number(days))); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; }
function dateDifference(dateA, dateB) { const [ay, am, ad] = String(dateA).split('-').map(Number); const [by, bm, bd] = String(dateB).split('-').map(Number); return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000); }
function localDateTimeFromTaskAdvance(task, advance) { if (!task?.date) throw new Error('La tarea no tiene fecha'); if (!['15m', '1h', '1d'].includes(advance)) throw new Error('La anticipación debe ser 15m, 1h o 1d'); if (advance !== '1d' && !task.time) throw new Error('Hace falta una hora para calcular este recordatorio'); const target = task.time ? localDateTimeFromTask(task) : parseLocalDateTime(`${task.date}T00:00`); return addMinutes(target, advance === '15m' ? -15 : advance === '1h' ? -60 : -1440); }

module.exports = { APP_TIMEZONE, getNow, getLocalParts, getToday, toLocalDate, toLocalDateTime, parseLocalDateTime, addMinutes, addLocalDays, dateDifference, localDateTimeFromTask, localDateTimeFromTaskAdvance };
