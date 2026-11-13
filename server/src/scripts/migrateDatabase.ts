import database, { migrateDatabase } from '../config/database';
void (async () => {
  try { await migrateDatabase(); console.log('Moodie database migrations are current.'); }
  catch { console.error('Moodie database migration failed. Check database connectivity, role permissions, and schema version.'); process.exitCode = 1; }
  finally { await database.end(); }
})();
