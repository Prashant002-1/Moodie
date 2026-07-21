import pool, { initializeDatabase } from '../src/config/database';

const setupTestDatabase = async () => {
  await initializeDatabase();
  const result = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'diary_entries', 'saved_films', 'genres')
  `);

  if (result.rows.length < 4) {
    throw new Error('Embedded test database is missing required tables');
  }
};

const cleanupTestDatabase = async () => {
  await pool.query(
    'TRUNCATE entry_comments, entry_reactions, follows, entry_media, diary_entries, saved_films, users RESTART IDENTITY CASCADE',
  );
};

export { setupTestDatabase, cleanupTestDatabase };
