#!/usr/bin/env python3
"""Create Moodie DB roles through a local SSM tunnel, then apply migrations.

Needs psql and a built Moodie runtime image. Secrets are passed using process
environment / a private temporary file, never logged or included in argv.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import quote
from urllib.request import urlopen
from moodie import Moodie, ROOT


def secret(moodie, output):
    return json.loads(moodie.aws('secretsmanager', 'get-secret-value', '--secret-id', moodie.outputs[output])['SecretString'])


def execute_sql(moodie, credentials, sql, port=15432, database='moodie'):
    executable = shutil.which('psql')
    if not executable:
        raise RuntimeError('psql is required for database bootstrap.')
    environment = dict(os.environ, PGHOST=moodie.outputs['DatabaseHost'], PGHOSTADDR='127.0.0.1', PGPORT=str(port), PGDATABASE=database, PGUSER=credentials['username'], PGPASSWORD=credentials['password'], PGSSLMODE='verify-full', PGSSLROOTCERT=str(ROOT / 'certs/rds-global-bundle.pem'), PGCONNECT_TIMEOUT='10')
    result = subprocess.run([executable, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], input=sql, text=True, capture_output=True, env=environment)
    if result.returncode:
        # A syntax error can echo SQL containing a role password. Never print it.
        details = result.stderr.replace(credentials['password'], '[redacted]')
        for literal in re.findall(r"'([^']*)'", sql):
            if len(literal) > 2: details = details.replace(literal, '[redacted]')
        raise RuntimeError('Database operation failed: ' + details[:1500])
    return result.stdout.strip()


def configure(moodie, image, port=15432):
    master = secret(moodie, 'MasterSecretArn')
    runtime = secret(moodie, 'RuntimeSecretArn')
    migrator = secret(moodie, 'MigrationSecretArn')
    for item, expected in [(runtime, 'moodie_app'), (migrator, 'moodie_migrator')]:
        if item['username'] != expected or not re.fullmatch('[A-Za-z0-9]{40}', item['password']):
            raise RuntimeError('Unexpected generated role credential format.')
    sql = 'BEGIN;\n'
    for item in [runtime, migrator]:
        username, password = item['username'], item['password']
        sql += f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='{username}') THEN CREATE ROLE {username} LOGIN; END IF; END $$;\n"
        sql += f"ALTER ROLE {username} LOGIN PASSWORD '{password}';\n"
    sql += '''
GRANT moodie_migrator TO moodie_owner WITH ADMIN OPTION;
ALTER DATABASE moodie OWNER TO moodie_migrator;
REVOKE ALL ON DATABASE moodie FROM PUBLIC;
GRANT CONNECT ON DATABASE moodie TO moodie_app;
ALTER SCHEMA public OWNER TO moodie_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO moodie_app;
ALTER DEFAULT PRIVILEGES FOR ROLE moodie_migrator IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO moodie_app;
ALTER DEFAULT PRIVILEGES FOR ROLE moodie_migrator IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO moodie_app;
COMMIT;
'''
    execute_sql(moodie, master, sql, port)
    elevated = execute_sql(moodie, master, "SELECT count(*) FROM pg_roles WHERE rolname IN ('moodie_app','moodie_migrator') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication);", port)
    if elevated != '0': raise RuntimeError('Moodie database roles have unexpected elevated privileges.')
    host = moodie.outputs['DatabaseHost']
    values = {'NODE_ENV': 'production', 'DATABASE_DRIVER': 'postgres', 'DATABASE_URL': f"postgresql://{migrator['username']}:{quote(migrator['password'], safe='')}@{host}:{port}/moodie", 'DATABASE_SSL_MODE': 'verify-full', 'DATABASE_CA_PATH': '/app/certs/rds-global-bundle.pem'}
    with tempfile.TemporaryDirectory(prefix='moodie-migration-') as directory:
        env_file = Path(directory) / 'migration.env'
        env_file.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
        env_file.chmod(0o600)
        result = subprocess.run(['docker', 'run', '--rm', '--add-host', host + ':host-gateway', '--env-file', str(env_file), image, 'node', 'server/dist/scripts/migrateDatabase.js'], text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError('Migration container failed; credentials were not logged.')
        print(result.stdout.strip())
    execute_sql(moodie, migrator, '''
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO moodie_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO moodie_app;
REVOKE INSERT,UPDATE,DELETE ON moodie_deploy_migrations,schema_migrations FROM moodie_app;
''', port)
    checks = execute_sql(moodie, runtime, "SELECT json_build_object('users',(SELECT count(*) FROM users),'canCreate',has_schema_privilege(current_user,'public','CREATE'),'canAlterMigration',has_table_privilege(current_user,'moodie_deploy_migrations','UPDATE'),'tls',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()));", port)
    parsed = json.loads(checks)
    if parsed['canCreate'] or parsed['canAlterMigration'] or not parsed['tls']:
        raise RuntimeError('Runtime database privilege or TLS check failed.')
    print(json.dumps({'runtimeDatabaseCheck': parsed}))


def configure_catalog(moodie):
    key = ''
    for name in ['server/.env', '.env']:
        file = ROOT / name
        if file.exists():
            for line in file.read_text().splitlines():
                if line.startswith('TMDB_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('\"\'')
    if not re.fullmatch('[a-fA-F0-9]{32}', key):
        raise RuntimeError('A valid Moodie TMDB API key is needed for the empty cloud catalog.')
    try:
        with urlopen('https://api.themoviedb.org/3/configuration?api_key=' + key, timeout=10) as response:
            if response.status != 200:
                raise RuntimeError('Catalog authentication failed.')
    except Exception:
        raise RuntimeError('Could not verify the catalog credential. No credential was logged.') from None
    value = secret(moodie, 'RuntimeSecretArn')
    value['tmdbApiKey'] = key
    with tempfile.TemporaryDirectory(prefix='moodie-catalog-') as directory:
        file = Path(directory) / 'secret.json'
        file.write_text(json.dumps(value))
        file.chmod(0o600)
        moodie.aws('secretsmanager', 'put-secret-value', '--secret-id', moodie.outputs['RuntimeSecretArn'], '--secret-string', 'file://' + str(file))
    print('Verified the Moodie catalog credential and stored it in the private runtime secret.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', default='moodie:runtime-20261001')
    parser.add_argument('--port', type=int, default=15432)
    parser.add_argument('--catalog', action='store_true')
    args = parser.parse_args()
    deployment = Moodie()
    configure(deployment, args.image, args.port)
    if args.catalog:
        configure_catalog(deployment)
