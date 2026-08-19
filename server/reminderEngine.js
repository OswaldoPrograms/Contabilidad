const database = require('./database');
const time = require('./time');

async function getDueReminders() {
  const now = time.getNow().toISOString();
  return database.findReminders({ sent: false }).then(reminders => reminders.filter(reminder => reminder.dateTime <= now));
}

module.exports = { getDueReminders };
