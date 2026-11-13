import request from 'supertest';
import { jest } from '@jest/globals';
import axios from 'axios';
import app from '../src/app';
import pool from '../src/config/database';

beforeEach(async () => {
  await pool.query('TRUNCATE movies CASCADE');
  await pool.query("INSERT INTO movies (id, title, overview, release_date, runtime, tmdb_data) VALUES (501,'A Cached Film','Existing synopsis','2001-01-01',110,'{\"tagline\":\"A remembered film\"}'), (502,'Another Film','Second synopsis','2002-01-01',90,'{}')");
  await pool.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES (501,18), (502,18)');
});

afterEach(() => jest.restoreAllMocks());
it('keeps search, detail, genres, and related films working from cached metadata during a provider outage', async () => {
  jest.spyOn(axios.Axios.prototype, 'request').mockRejectedValue(new Error('Provider unavailable'));
  const search = await request(app).get('/api/catalog/search?q=Cached');
  expect(search.status).toBe(200); expect(search.body.results[0].id).toBe(501);
  for (let i = 0; i < 3; i++) {
    const detail = await request(app).get('/api/catalog/movies/501');
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ title: 'A Cached Film', runtime: 110, tagline: 'A remembered film', genre_ids: [18], poster_path: null });
    expect(detail.body).not.toHaveProperty('tmdb_data');
  }
  expect((await request(app).get('/api/catalog/genres')).body.genres.length).toBeGreaterThan(0);
  expect((await request(app).get('/api/catalog/movies/501/related')).body.results[0].id).toBe(502);
  expect((await request(app).get('/api/catalog/search?q=Missing')).body.results).toEqual([]);
  expect((await request(app).get('/api/catalog/search?q=%25')).body.results).toEqual([]);
  expect((await request(app).get('/api/catalog/trending?page=0')).status).toBe(400);
});
