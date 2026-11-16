#!/usr/bin/env python3
"""Read-only fingerprints for a Moodie RDS snapshot restore drill.

Use a separate SSM database tunnel for each endpoint. This emits row counts,
hashes, schema metadata and permission flags; never records or credentials.
"""
import argparse
import json
import re
from moodie import Moodie
from bootstrap_database import execute_sql, secret


def probe(moodie, instance, port):
    if instance != moodie.outputs['DatabaseId'] and not re.fullmatch(r'moodie-dev-restore-check-\d{8}', instance):
        raise RuntimeError('Probe only supports the Moodie database or an explicitly named disposable restore.')
    details = moodie.aws('rds','describe-db-instances','--db-instance-identifier',instance)['DBInstances'][0]
    if details['DBInstanceStatus'] != 'available' or details['PubliclyAccessible'] or not details['StorageEncrypted']:
        raise RuntimeError('Restore endpoint must be available, private and encrypted.')
    group = details['DBParameterGroups'][0]
    if group['ParameterApplyStatus'] != 'in-sync':
        raise RuntimeError('Wait until the restored parameter group is fully applied.')
    force_tls = moodie.aws('rds','describe-db-parameters','--db-parameter-group-name',group['DBParameterGroupName'],'--query',"Parameters[?ParameterName=='rds.force_ssl'].ParameterValue")
    if force_tls != ['1']:
        raise RuntimeError('RDS must require TLS before verification.')
    moodie.outputs['DatabaseHost'] = details['Endpoint']['Address']
    runtime = secret(moodie,'RuntimeSecretArn')
    tables = execute_sql(moodie,runtime,"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",port).splitlines()
    if not tables or any(not re.fullmatch('[a-z_]+',table) for table in tables):
        raise RuntimeError('Unexpected or missing table names.')
    statements = ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;']
    statements.append("""SELECT jsonb_build_object('kind','schema','value',jsonb_agg(c ORDER BY table_name,ordinal_position)) FROM
(SELECT table_name,column_name,ordinal_position,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public') c;""")
    statements.append("""SELECT jsonb_build_object('kind','permissions','value',jsonb_build_object('tls',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),'canCreate',has_schema_privilege(current_user,'public','CREATE'),'canUpdateMigrations',has_table_privilege(current_user,'moodie_deploy_migrations','UPDATE')));""")
    for table in tables:
        statements.append(f'''SELECT jsonb_build_object('kind','table','name','{table}','value',jsonb_build_object('rows',count(*),'digest',md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')))) FROM public."{table}" t;''')
    statements.append('COMMIT;')
    rows = [json.loads(line) for line in execute_sql(moodie,runtime,'\n'.join(statements),port).splitlines() if line.startswith('{')]
    report = {'instance': instance, 'tables': {}}
    for row in rows:
        if row['kind'] == 'table': report['tables'][row['name']] = row['value']
        else: report[row['kind']] = row['value']
    report['permissions']['forceTls'] = True
    permissions = report['permissions']
    if not permissions['tls'] or permissions['canCreate'] or permissions['canUpdateMigrations']:
        raise RuntimeError('Restored runtime permissions or TLS differ from the required boundary.')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--instance',default='moodie-dev-db')
    parser.add_argument('--port',type=int,default=15432)
    args = parser.parse_args()
    print(json.dumps(probe(Moodie(),args.instance,args.port),indent=2))
