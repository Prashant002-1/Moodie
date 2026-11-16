/** Disposable native QA server. Never opens the user's database. */
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync } from 'node:fs';
process.env.DATABASE_PATH = mkdtempSync(path.join(os.tmpdir(), 'moodie-ios-qa-'));
process.env.NODE_ENV = 'development';
process.env.COOKIE_SECURE = 'false';
process.env.TMDB_API_KEY = '';
process.env.DATABASE_SNAPSHOT_PATH = '';
delete process.env.VERCEL;
process.env.PORT = '3101';
const { default: pool, initializeDatabase } = await import('../../server/src/config/database');
const { hashPassword } = await import('../../server/src/services/sessionService');
const { default: app } = await import('../../server/src/app');
await initializeDatabase();
const hash = await hashPassword('native-test-password');
const people = [
  ['ios_viewer', 'Looking for the films that stay.'],
  ['ananya', 'A film can leave two feelings at once.'],
  ['elena', 'Small moments, on screen and off.'],
  ['hiro', 'Usually thinking about the last scene.'],
];
// Sample accounts have already made the onboarding choice. Sign up to see the first-run screen.
for (const [username,bio] of people) await pool.query("INSERT INTO users(username,email,password_hash,bio,ai_mode) VALUES ($1,$2,$3,$4,'off')",[username,username+'@example.test',hash,bio]);
const films = [
  [244786, 'Whiplash', 'A young drummer enters a demanding music conservatory, where ambition and obsession collide.', '2014-10-10', '/7fn624j5lj3xTme2SgiLCeuedmO.jpg', '/6bbZ6XyvgfjhQwbplnUh1LSj1ky.jpg', 107],
  [4232, 'Scream', 'A year after the murder of her mother, a teenager and her friends become the targets of a masked killer.', '1996-12-20', '/lr9ZIrmuwVmZhpZuTCW8D9g0ZJe.jpg', null, 112],
  [1016084, 'BlackBerry', 'Two entrepreneurs build a device that changes how people communicate, and struggle with everything that follows.', '2023-05-11', '/neV35lK7em4rIY9QIoH1cruErPA.jpg', null, 120],
  [666277, 'Past Lives', 'Two childhood friends reconnect years after Nora’s family emigrates from South Korea.', '2023-06-02', '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', '/7HR38hMBl23lf38MAN63y4pKsHz.jpg', 106],
  [976893, 'Perfect Days', 'Hirayama finds beauty in music, books, and the everyday rhythms of life in Tokyo.', '2023-11-10', '/tvUHVSTJV9ITON3oyHaWp7oaAc8.jpg', null, 124],
  [785084, 'The Whale', 'A reclusive teacher attempts to reconnect with his estranged teenage daughter.', '2022-12-09', '/jQ0gylJMxWSL490sy0RrPj1Lj7e.jpg', null, 117],
];
for (const [id,title,overview,release,poster,backdrop,runtime] of films) {
  const tmdb = {id,title,overview,release_date:release,poster_path:poster,backdrop_path:backdrop,runtime,genre_ids:[],genres:[],popularity:0,vote_average:0,vote_count:0};
  await pool.query('INSERT INTO movies(id,title,overview,release_date,poster_path,backdrop_path,tmdb_data,runtime) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[id,title,overview,release,poster,backdrop,JSON.stringify(tmdb),runtime]);
}
const rows = [
  [1,244786,'I left with my shoulders up around my ears. The final scene felt triumphant and frightening at the same time.',0.1,0.6,0.1,0.2,0.8,0,0.5],
  [2,244786,'The last ten minutes made me forget to breathe. I wanted him to stop, and I wanted him to keep going.',0.1,0.7,0.1,0.2,0.7,0,0.6],
  [2,4232,'Watched it with friends who knew every line. I expected tension, but mostly I remember how much we laughed together.',0.1,0.9,0,0,0.4,0,0.6],
  [3,976893,'I walked home without headphones after this. For once, the ordinary things felt like enough.',0.9,0.5,0.2,0,0,0,0.4],
  [4,666277,'I kept thinking about the people we become in other people’s memories. The silence at the end said more than I could.',0.4,0.1,0.8,0,0.1,0,0.5],
];
for (let n=0;n<rows.length;n++) {
  const [user,movie,note,...feelings]=rows[n];
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,note,watched_on,visibility,neutral,happy,sad,angry,fearful,disgusted,surprised,created_at)
    VALUES ($1,$2,$3,'2026-09-18','public',$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP - ($11::int * INTERVAL '1 hour'))`,[user,movie,note,...feelings,rows.length-n]);
}
await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES (1,2),(1,3)');
await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES (2,1),(4,1)');
await pool.query(`INSERT INTO film_suggestions(sender_id,recipient_id,movie_id,origin,reason,source_entry_id) VALUES
  (2,1,4232,'sent','You said you wanted something we could laugh through together. This is that kind of scary.',3),
  (4,1,666277,'sent','For that conversation we had about the lives we might have lived. The last scene stayed with me.',5),
  (3,1,976893,'discovered','',4)`);
await pool.query('INSERT INTO saved_films(user_id,movie_id) VALUES(1,976893)');
// Reminders the viewer set for themselves: one already due, one still ahead.
await pool.query("UPDATE film_suggestions SET remind_at = CURRENT_TIMESTAMP - INTERVAL '2 hours' WHERE id = 1");
await pool.query("UPDATE film_suggestions SET remind_at = CURRENT_TIMESTAMP + INTERVAL '3 days' WHERE id = 2");
// Films the viewer recommended: ananya replied; hiro has not answered yet.
await pool.query(`INSERT INTO film_suggestions(sender_id,recipient_id,movie_id,origin,reason,linked_entry_id,shared_at,created_at) VALUES
  (1,2,244786,'sent','You play. I want to know if the last scene feels like a win to you.',2,CURRENT_TIMESTAMP - INTERVAL '1 day',CURRENT_TIMESTAMP - INTERVAL '6 days'),
  (1,4,785084,'sent','You said you wanted one that stays with you. This did, for days.',NULL,NULL,CURRENT_TIMESTAMP - INTERVAL '2 days')`);
await pool.query(`INSERT INTO suggestion_replies(suggestion_id,entry_id,enjoyment,highlights,note,created_at,updated_at) VALUES
  (4,2,'loved','{music,ending}','It felt like a win and a loss at once. I have not stopped thinking about his face.',CURRENT_TIMESTAMP - INTERVAL '1 day',CURRENT_TIMESTAMP - INTERVAL '1 day')`);
// Cached-only search/details keep QA deterministic and avoid remote catalog requests.
const server = app.listen(3101,'127.0.0.1');
server.on('listening',()=>console.log('Native QA API ready at http://127.0.0.1:3101; account ios_viewer; disposable data '+process.env.DATABASE_PATH));
server.on('error',async error=>{console.error(error.message);await pool.end();process.exit(1)});
process.on('SIGTERM', async ()=>{await pool.end();process.exit(0)});
