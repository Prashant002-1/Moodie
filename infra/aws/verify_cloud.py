#!/usr/bin/env python3
"""Disposable AWS verification. Never creates test accounts in the app database.

Run with the database tunnel on port 15432. After prepare, forward local 3302
to instance port 3002 and run the platform and capacity scripts. Cleanup drops
only the hard-coded disposable database and removes its container/env file.
"""
import argparse
import base64
import json
from pathlib import Path
import shlex
import subprocess
import tempfile
from urllib.parse import quote
from moodie import Moodie, ROOT
from bootstrap_database import execute_sql, secret

DATABASE = 'moodie_test_cloud'


def prepare(moodie, image, port):
    master = secret(moodie, 'MasterSecretArn')
    migrator = secret(moodie, 'MigrationSecretArn')
    exists = execute_sql(moodie, master, f"SELECT count(*) FROM pg_database WHERE datname='{DATABASE}'", port)
    if exists != '0':
        raise RuntimeError('Verification database already exists. Inspect it or explicitly clean up before starting a fresh run.')
    execute_sql(moodie, master, f'CREATE DATABASE {DATABASE} OWNER moodie_migrator', port)
    execute_sql(moodie, migrator, f'''
REVOKE ALL ON DATABASE {DATABASE} FROM PUBLIC;
GRANT CONNECT ON DATABASE {DATABASE} TO moodie_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO moodie_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO moodie_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO moodie_app;
''', port, DATABASE)
    host = moodie.outputs['DatabaseHost']
    values = {
        'NODE_ENV': 'production', 'DATABASE_DRIVER': 'postgres',
        'DATABASE_URL': f"postgresql://{migrator['username']}:{quote(migrator['password'], safe='')}@{host}:{port}/{DATABASE}",
        'DATABASE_SSL_MODE': 'verify-full', 'DATABASE_CA_PATH': '/app/certs/rds-global-bundle.pem',
    }
    with tempfile.TemporaryDirectory(prefix='moodie-qa-') as directory:
        file = Path(directory) / 'migration.env'
        file.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
        file.chmod(0o600)
        result = subprocess.run(['docker', 'run', '--rm', '--add-host', host + ':host-gateway', '--env-file', str(file), image, 'node', 'server/dist/scripts/migrateDatabase.js'], text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError('Disposable database migration failed; credentials were not logged.')
    execute_sql(moodie, migrator, '''
REVOKE INSERT,UPDATE,DELETE ON moodie_deploy_migrations,schema_migrations FROM moodie_app;
INSERT INTO movies(id,title,overview,release_date,tmdb_data) VALUES
(101,'Quiet Film','A small story that stayed with us.','2020-01-01',
'{"id":101,"title":"Quiet Film","overview":"A small story that stayed with us.","release_date":"2020-01-01","genre_ids":[],"vote_average":7,"vote_count":10,"popularity":1}');
''', port, DATABASE)
    deployed = json.loads((ROOT / '.aws/deployment.json').read_text())['image']
    # Read the existing root-only runtime env on the host. No secret appears in
    # SSM command history. Only the database name changes; catalog is disabled.
    code = '''from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
p=Path('/etc/moodie/verification.env')
values=dict(line.split('=',1) for line in Path('/etc/moodie/app.env').read_text().splitlines())
u=urlsplit(values['DATABASE_URL'])
assert u.path == '/moodie'
values['DATABASE_URL']=urlunsplit((u.scheme,u.netloc,'/moodie_test_cloud','',''))
values['MOODIE_DATA_SCOPE']='verification'
values['TMDB_API_KEY']=''
p.touch(mode=0o600,exist_ok=False)
p.write_text(''.join(f'{k}={v}\\n' for k,v in values.items()))
'''
    encoded = base64.b64encode(code.encode()).decode()
    moodie.shell(['set -eu', 'printf %s ' + shlex.quote(encoded) + ' | base64 -d | python3',
        'docker run -d --init --name moodie-verification --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m,uid=1000,gid=1000 --cap-drop ALL --security-opt no-new-privileges --memory=512m --memory-swap=512m --cpus=0.5 --pids-limit=128 --publish 127.0.0.1:3002:3001 --env-file /etc/moodie/verification.env --log-opt max-size=5m --log-opt max-file=1 ' + shlex.quote(deployed)])
    print('Disposable verification API started on instance loopback port 3002.')


def fingerprint(moodie, port):
    runtime = secret(moodie, 'RuntimeSecretArn')
    sql = '''SELECT json_build_object(
'users',(SELECT count(*) FROM users),
'diary',(SELECT count(*) FROM diary_entries),
'saved',(SELECT count(*) FROM user_movies),
'sessions',(SELECT count(*) FROM sessions),
'privateNativeDiary',(SELECT count(*) FROM diary_entries WHERE note='Private native diary words' AND visibility='private'),
'diaryDigest',(SELECT md5(coalesce(string_agg(row_to_json(d)::text,',' ORDER BY id),'')) FROM diary_entries d),
'userDigest',(SELECT md5(coalesce(string_agg(row_to_json(u)::text,',' ORDER BY id),'')) FROM users u),
'sessionDigest',(SELECT md5(coalesce(string_agg(row_to_json(s)::text,',' ORDER BY token_hash),'')) FROM sessions s),
'migrations',(SELECT count(*) FROM moodie_deploy_migrations),
'tls',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()));'''
    return json.loads(execute_sql(moodie, runtime, sql, port, DATABASE))


def cleanup(moodie, port):
    moodie.shell(['docker rm -f moodie-verification >/dev/null 2>&1 || true', 'rm -f /etc/moodie/verification.env'])
    master = secret(moodie, 'MasterSecretArn')
    execute_sql(moodie, master, f'DROP DATABASE IF EXISTS {DATABASE} WITH (FORCE)', port)
    print('Removed only the disposable verification container, env file and database.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare','fingerprint','cleanup'])
    parser.add_argument('--image', default='moodie:runtime-20261001')
    parser.add_argument('--port', type=int, default=15432)
    args = parser.parse_args()
    deployment = Moodie()
    if args.action == 'prepare': prepare(deployment,args.image,args.port)
    elif args.action == 'cleanup': cleanup(deployment,args.port)
    else: print(json.dumps(fingerprint(deployment,args.port),indent=2))
