import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true, quiet: true });

const hostedTestUrl = process.env.MOODIE_TEST_DATABASE_URL;
if (hostedTestUrl) {
  const url = new URL(hostedTestUrl);
  if (!/^\/moodie_test_[a-z0-9_]+$/.test(url.pathname) || !['127.0.0.1', 'localhost', 'moodie-test-postgres'].includes(url.hostname)) {
    throw new Error('PostgreSQL tests require a named disposable local moodie_test_ database.');
  }
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_DRIVER = 'postgres';
  process.env.DATABASE_URL = hostedTestUrl;
  process.env.DATABASE_SSL_MODE = 'disable';
} else {
  process.env.DATABASE_DRIVER = 'embedded';
  if (process.env.DATABASE_PATH !== 'memory://') throw new Error('Refusing to run server tests outside the in-memory database.');
}
