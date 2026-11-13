/** Operator tool. Use the configured persistent DB while the API is stopped.
 * Usage: npx tsx server/src/scripts/moderateCommunity.ts list
 *        npx tsx server/src/scripts/moderateCommunity.ts resolve REPORT_ID remove|dismiss REASON
 */
import pool, { initializeDatabase } from '../config/database';
import { z } from 'zod';

async function main() {
  const [command, rawID, rawAction, ...reasonParts] = process.argv.slice(2);
  await initializeDatabase();
  if (command === 'list') {
    const reports = await pool.query(`SELECT r.id, r.target_kind, r.target_id, r.reason, r.details, r.created_at,
      CASE WHEN r.target_kind = 'response' THEN (SELECT note FROM diary_entries WHERE id = r.target_id)
           WHEN r.target_kind = 'comment' THEN (SELECT body FROM entry_comments WHERE id = r.target_id)
           ELSE (SELECT bio FROM users WHERE id = r.target_id) END AS reported_text
      FROM moderation_reports r WHERE status = 'open' ORDER BY created_at LIMIT 100`);
    console.log(JSON.stringify(reports.rows, null, 2));
    return;
  }
  if (command !== 'resolve') throw new Error('Use list, or resolve REPORT_ID remove|dismiss REASON');
  const id = z.coerce.number().int().positive().parse(rawID);
  const action = z.enum(['remove', 'dismiss']).parse(rawAction);
  const reason = z.string().trim().min(5).max(1000).parse(reasonParts.join(' '));
  await pool.transaction(async client => {
    const report = await client.query("SELECT * FROM moderation_reports WHERE id = $1 AND status = 'open' FOR UPDATE", [id]);
    if (!report.rowCount) throw new Error('Open report not found');
    const target = report.rows[0];
    if (action === 'remove') {
      await client.query(`INSERT INTO moderation_actions (target_kind,target_id,reason) VALUES ($1,$2,$3)
        ON CONFLICT (target_kind,target_id) DO UPDATE SET reason = EXCLUDED.reason`, [target.target_kind, target.target_id, reason]);
    }
    await client.query(`UPDATE moderation_reports SET status = $1, resolved_at = CURRENT_TIMESTAMP
      WHERE target_kind = $2 AND target_id = $3 AND status = 'open'`, [action === 'remove' ? 'removed' : 'dismissed', target.target_kind, target.target_id]);
  });
  console.log(`Report ${id} resolved: ${action}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
