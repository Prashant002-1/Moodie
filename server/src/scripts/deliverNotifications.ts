import database, { initializeDatabase } from '../config/database';
import { deliverPending } from '../notifications/mailer';
import { queueDueReminders } from '../notifications/outbox';

// One pass: queue reminders that have come due, then hand every pending email to
// the mailer. Nothing runs this on a schedule. With no provider connected the
// default mailer sends nothing and marks each row skipped.
void (async () => {
  try {
    await initializeDatabase();
    const reminders = await queueDueReminders();
    const { sent, skipped, failed } = await deliverPending();
    console.log(`Moodie notifications: ${reminders} due reminder${reminders === 1 ? '' : 's'} queued; ${sent} sent, ${skipped} skipped, ${failed} failed.`);
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error(`Moodie notifications could not be delivered: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally { await database.end().catch(() => undefined); }
})();
