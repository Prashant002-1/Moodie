import { promises as fs } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { env, projectRoot } from './env';

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

const embedded = new PGlite(env.databasePath);

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
  query<Row extends DatabaseRow = DatabaseRow>(sql: string, params: any[] = []) {
    return query<Row>(embedded as QueryTarget, sql, params);
  }

  exec(sql: string) {
    return embedded.exec(sql);
  }

  async connect(): Promise<ConnectedDatabaseClient> {
    return {
      ...clientFor(embedded as QueryTarget),
      release: () => undefined,
    };
  }

  transaction<T>(callback: (client: DatabaseClient) => Promise<T>) {
    return embedded.transaction(transaction => callback(clientFor(transaction as QueryTarget)));
  }

  end() {
    return embedded.close();
  }
}

const database = new EmbeddedDatabase();
let initialization: Promise<void> | undefined;

export const initializeDatabase = () => {
  initialization ||= (async () => {
    if (env.databasePath !== 'memory://') {
      await fs.mkdir(path.dirname(env.databasePath), { recursive: true });
    }
    const schema = await fs.readFile(path.join(projectRoot, 'database/schema.sql'), 'utf8');
    await database.exec(schema);
  })();
  return initialization;
};

export default database;
