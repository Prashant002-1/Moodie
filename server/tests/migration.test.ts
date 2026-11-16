import { promises as fs } from 'fs';
import path from 'path';
import pool from '../src/config/database';
import { projectRoot } from '../src/config/env';

it('imports legacy data once without resurrecting records deleted from the diary', async () => {
  const user = await pool.query("INSERT INTO users (email, username, password_hash) VALUES ('legacy@example.test','legacy','unused') RETURNING id");
  await pool.query("INSERT INTO movies (id, title) VALUES (901,'Legacy Film') ON CONFLICT DO NOTHING");
  await pool.query("INSERT INTO user_movies (user_id, movie_id, status) VALUES ($1,901,'watchlist'), ($1,901,'watched')", [user.rows[0].id]);
  await pool.query("DELETE FROM schema_migrations WHERE id = 'legacy-diary-import'");
  const schema = await fs.readFile(path.join(projectRoot, 'database/schema.sql'), 'utf8');
  await pool.exec(schema);
  expect((await pool.query('SELECT * FROM diary_entries')).rowCount).toBe(1);
  expect((await pool.query('SELECT * FROM saved_films')).rowCount).toBe(1);
  await pool.query('DELETE FROM diary_entries'); await pool.query('DELETE FROM saved_films');
  await pool.exec(schema);
  expect((await pool.query('SELECT * FROM diary_entries')).rowCount).toBe(0);
  expect((await pool.query('SELECT * FROM saved_films')).rowCount).toBe(0);
});
