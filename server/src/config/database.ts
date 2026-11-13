import { promises as fs } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { Pool, types } from 'pg';
import { readFileSync } from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { env, projectRoot } from './env';

// The HTTP contract uses numeric IDs. node-postgres returns int8 as strings
// by default, unlike PGlite; reject overflow instead of silently rounding it.
types.setTypeParser(types.builtins.INT8, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError('Database integer exceeds the API safe-integer range.');
  return number;
});

export type DatabaseRow = any;

export type DatabaseResult<Row extends DatabaseRow = DatabaseRow> = {
  rows: Row[];
  rowCount: number;
};

export type DatabaseClient = {
  query<Row extends DatabaseRow = DatabaseRow>(sql: string, params?: any[]): Promise<DatabaseResult<Row>>;
};

export type ConnectedDatabaseClient = DatabaseClient & {
  release(): void;
};

type QueryTarget = {
  query: <Row extends DatabaseRow = DatabaseRow>(sql: string, params?: any[]) => Promise<{
    rows: Row[];
    affectedRows?: number;
  }>;
};

let releaseLock: (() => Promise<void>) | undefined;
const acquireLock = async () => {
  if (env.databasePath === 'memory://' || env.databaseSnapshotPath) return;
  const lockPath = `${env.databasePath}.lock`;
  await fs.mkdir(path.dirname(env.databasePath), { recursive: true });
  const owner = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(lockPath, 'wx', 0o600);
      await handle.writeFile(owner);
      await handle.close();
      releaseLock = async () => { if (await fs.readFile(lockPath, 'utf8').catch(() => '') === owner) await fs.unlink(lockPath); };
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const contents = await fs.readFile(lockPath, 'utf8').catch(() => '');
      let pid: number;
      try { pid = JSON.parse(contents).pid; } catch { throw new Error(`Database lock is being acquired: ${lockPath}`); }
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid database lock: ${lockPath}`);
      try { process.kill(pid, 0); }
      catch (probe) {
        if ((probe as NodeJS.ErrnoException).code === 'ESRCH' && await fs.readFile(lockPath, 'utf8').catch(() => '') === contents) { await fs.unlink(lockPath).catch(() => undefined); continue; }
      }
      throw new Error(`Database already in use by process ${pid}. Stop that process before opening this database.`);
    }
  }
  throw new Error('Could not acquire the database lock. Try again.');
};

const createEmbeddedDatabase = async () => {
  if (process.env.VERCEL || (env.nodeEnv === 'production' && (env.databasePath === 'memory://' || env.databaseSnapshotPath))) {
    throw new Error('Accounts require persistent storage. Run the Express server with a persistent DATABASE_PATH; the Vercel in-memory demo cannot store accounts.');
  }
  if (env.databaseSnapshotPath) {
    const snapshot = await fs.readFile(env.databaseSnapshotPath);
    return PGlite.create({
      dataDir: 'memory://',
      loadDataDir: new Blob([new Uint8Array(snapshot)]),
    });
  }

  await acquireLock();
  try { return await PGlite.create(env.databasePath); }
  catch (error) { await releaseLock?.(); throw error; }
};

const query = async <Row extends DatabaseRow = DatabaseRow>(
  target: QueryTarget,
  sql: string,
  params: any[] = [],
): Promise<DatabaseResult<Row>> => {
  const result = await target.query<Row>(sql, params);
  return {
    rows: result.rows,
    rowCount: result.rows.length || result.affectedRows || 0,
  };
};

const clientFor = (target: QueryTarget): DatabaseClient => ({
  query: (sql, params) => query(target, sql, params),
});

class EmbeddedDatabase implements DatabaseClient {
  private embedded?: ReturnType<typeof createEmbeddedDatabase>;
  private getDatabase() { return this.embedded ||= createEmbeddedDatabase(); }

  async query<Row extends DatabaseRow = DatabaseRow>(sql: string, params: any[] = []) {
    const embedded = await this.getDatabase();
    return query<Row>(embedded as QueryTarget, sql, params);
  }

  async exec(sql: string) {
    const embedded = await this.getDatabase();
    return embedded.exec(sql);
  }

  async connect(): Promise<ConnectedDatabaseClient> {
    const embedded = await this.getDatabase();
    return {
      ...clientFor(embedded as QueryTarget),
      release: () => undefined,
    };
  }

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>) {
    const embedded = await this.getDatabase();
    return embedded.transaction(transaction => callback(clientFor(transaction as QueryTarget)));
  }

  async dump(compression: 'none' | 'gzip' | 'auto' = 'gzip') {
    const embedded = await this.getDatabase();
    return embedded.dumpDataDir(compression);
  }

  async end() {
    const embedded = await this.getDatabase();
    try { await embedded.close(); } finally { await releaseLock?.(); }
  }
}

class HostedDatabase implements DatabaseClient {
  private pool?: Pool;
  private getPool() {
    if (this.pool) return this.pool;
    if (!env.databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL.');
    const url = new URL(env.databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid PostgreSQL URL.');
    if (url.search) throw new Error('Configure PostgreSQL TLS through DATABASE_SSL_MODE and DATABASE_CA_PATH, not URL parameters.');
    if (!['verify-full', 'disable'].includes(env.databaseSslMode)) throw new Error('Invalid DATABASE_SSL_MODE.');
    if (!Number.isInteger(env.databasePoolSize) || env.databasePoolSize < 1 || env.databasePoolSize > 20) throw new Error('DATABASE_POOL_SIZE must be between 1 and 20.');
    this.pool = new Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseSslMode === 'disable' ? false : {
        rejectUnauthorized: true,
        ...(env.databaseCaPath ? { ca: readFileSync(env.databaseCaPath, 'utf8') } : {}),
        ...(env.databaseTlsServername ? { servername: env.databaseTlsServername } : {}),
      },
      max: env.databasePoolSize,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 10000,
      query_timeout: 12000,
      keepAlive: true,
      application_name: 'moodie-api',
    });
    // An idle connection can disappear during maintenance. pg removes it and
    // reconnects on demand; handling this event prevents an uncaught exception.
    this.pool.on('error', () => console.error('An idle PostgreSQL connection was lost. The pool will reconnect.'));
    return this.pool;
  }
  async query<Row extends DatabaseRow = DatabaseRow>(sql: string, params: any[] = []): Promise<DatabaseResult<Row>> {
    const result = await this.getPool().query(sql, params);
    return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 };
  }
  async exec(sql: string) { await this.getPool().query(sql); }
  async connect(): Promise<ConnectedDatabaseClient> {
    const client = await this.getPool().connect();
    return {
      async query<Row extends DatabaseRow = DatabaseRow>(sql: string, params: any[] = []): Promise<DatabaseResult<Row>> {
        const result = await client.query(sql, params);
        return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 };
      },
      release: () => client.release(),
    };
  }
  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  async dump(_compression: 'none' | 'gzip' | 'auto' = 'gzip'): Promise<Blob> {
    throw new Error('Use PostgreSQL backups for a hosted database. Embedded snapshots cannot export PostgreSQL.');
  }
  async end() { await this.pool?.end(); this.pool = undefined; }
}

if (!['embedded', 'postgres'].includes(env.databaseDriver)) throw new Error('DATABASE_DRIVER must be embedded or postgres.');
const database = env.databaseDriver === 'postgres' ? new HostedDatabase() : new EmbeddedDatabase();
const migrations = async () => {
  const directory = path.join(projectRoot, 'database/migrations');
  const names = (await fs.readdir(directory)).filter(name => /^\d{12}-[a-z0-9-]+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error('No PostgreSQL migrations are packaged.');
  return Promise.all(names.map(async version => {
    const sql = await fs.readFile(path.join(directory, version), 'utf8');
    return { version, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
};

// Only the separate migration command (or isolated test runner) applies DDL.
// Production API credentials need data access only, never schema ownership.
export const migrateDatabase = async () => {
  if (env.databaseDriver !== 'postgres') {
    await database.exec(await fs.readFile(path.join(projectRoot, 'database/schema.sql'), 'utf8'));
    return;
  }
  const pending = await migrations();
  await database.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(742619035)');
    await client.query('CREATE TABLE IF NOT EXISTS moodie_deploy_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const migration of pending) {
      const existing = await client.query('SELECT checksum FROM moodie_deploy_migrations WHERE version = $1', [migration.version]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== migration.checksum) throw new Error('A deployed migration was changed. Add a new versioned migration.');
        continue;
      }
      await client.query(migration.sql);
      await client.query('INSERT INTO moodie_deploy_migrations (version, checksum) VALUES ($1, $2)', [migration.version, migration.checksum]);
    }
  });
};
let initialization: Promise<void> | undefined;

export const initializeDatabase = () => {
  initialization ||= (async () => {
    if (env.databaseDriver === 'postgres') {
      if (env.nodeEnv === 'test') { await migrateDatabase(); return; }
      const applied = await database.query('SELECT version, checksum FROM moodie_deploy_migrations');
      const expected = await migrations();
      if (expected.some(migration => !applied.rows.some(row => row.version === migration.version && row.checksum === migration.checksum))) {
        throw new Error('Database schema is not ready for this release. Run the migration command first.');
      }
      return;
    }
    if (env.databasePath !== 'memory://') await fs.mkdir(path.dirname(env.databasePath), { recursive: true });
    await migrateDatabase();
  })();
  return initialization;
};

export const dumpDatabase = (compression: 'none' | 'gzip' | 'auto' = 'gzip') => (
  database.dump(compression)
);

export default database;
