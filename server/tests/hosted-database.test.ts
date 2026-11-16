import database, { migrateDatabase } from '../src/config/database';

const hosted = process.env.DATABASE_DRIVER === 'postgres' ? describe : describe.skip;
hosted('hosted PostgreSQL adapter', () => {
  it('preserves numeric ID contracts without rounding oversized integers', async () => {
    expect((await database.query('SELECT 42::bigint AS id')).rows[0].id).toBe(42);
    await expect(database.query('SELECT 9007199254740993::bigint AS id')).rejects.toThrow('safe-integer');
  });
  it('rolls back a failed transaction and returns its connection to the pool', async () => {
    await expect(database.transaction(async client => {
      await client.query("INSERT INTO users (email,username,password_hash) VALUES ('rollback@example.test','rollback_probe','unused')");
      throw new Error('rollback probe');
    })).rejects.toThrow('rollback probe');
    expect((await database.query("SELECT id FROM users WHERE username='rollback_probe'")).rowCount).toBe(0);
    const results = await Promise.all(Array.from({ length: 12 }, () => database.transaction(async client => {
      const result = await client.query('SELECT 42 AS value');
      return result.rows[0].value;
    })));
    expect(results).toEqual(Array(12).fill(42));
  });
  it('records each migration once and preserves existing data on repeated runs', async () => {
    await database.query("INSERT INTO movies(id,title) VALUES (987654,'Migration marker')");
    await migrateDatabase();
    await migrateDatabase();
    expect((await database.query("SELECT title FROM movies WHERE id=987654")).rows[0].title).toBe('Migration marker');
    const versions = await database.query('SELECT version FROM moodie_deploy_migrations');
    expect(new Set(versions.rows.map(row => row.version)).size).toBe(versions.rowCount);
  });
});
