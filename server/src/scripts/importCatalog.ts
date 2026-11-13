import { promises as fs } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import database, { initializeDatabase } from '../config/database';
import { projectRoot } from '../config/env';

// Import only the film metadata already bundled with this repository.
// Never import sample people, passwords, diaries, follows, or other social data.
async function main() {
  await initializeDatabase();
  const snapshot = await fs.readFile(path.join(projectRoot, 'database/demo-seed.tgz'));
  const source = await PGlite.create({ dataDir: 'memory://', loadDataDir: new Blob([new Uint8Array(snapshot)]) });
  try {
    const movies = await source.query('SELECT * FROM movies');
    const genres = await source.query('SELECT * FROM genres');
    const movieGenres = await source.query('SELECT * FROM movie_genres');
    await database.transaction(async client => {
      for (const genre of genres.rows as any[]) await client.query('INSERT INTO genres (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [genre.id, genre.name]);
      for (const movie of movies.rows as any[]) {
        await client.query(`INSERT INTO movies (id, title, overview, release_date, poster_path, backdrop_path, runtime, tmdb_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
          [movie.id, movie.title, movie.overview, movie.release_date, movie.poster_path, movie.backdrop_path, movie.runtime, JSON.stringify(movie.tmdb_data)]);
      }
      for (const pair of movieGenres.rows as any[]) await client.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [pair.movie_id, pair.genre_id]);
    });
    console.log(`Imported ${movies.rows.length} bundled films. Existing records and all account data were preserved.`);
  } finally { await source.close(); }
}
void (async () => {
  let failed = false;
  try { await main(); } catch (error) { failed = true; console.error('Catalog import failed:', error); }
  try { await database.end(); } catch { failed = true; }
  process.exitCode = failed ? 1 : 0;
})();
