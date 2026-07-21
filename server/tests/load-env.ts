import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true, quiet: true });

if (process.env.DATABASE_PATH !== 'memory://') {
  throw new Error('Refusing to run server tests outside the in-memory database.');
}
