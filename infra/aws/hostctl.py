#!/usr/bin/env python3
"""Root-only Moodie host operations. Credentials never enter command arguments."""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

DIRECTORY = Path('/etc/moodie')


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs).stdout.strip()


def atomic(path, content, mode=0o600):
    temporary = path.with_suffix(path.suffix + '.new')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content)
    os.chmod(temporary, mode)
    os.replace(temporary, path)


def config():
    return json.loads((DIRECTORY / 'config.json').read_text())


def aws(*args):
    return run(['aws', '--region', config()['region'], *args])


def environment():
    cfg = config()
    secret = json.loads(json.loads(aws('secretsmanager', 'get-secret-value', '--secret-id', cfg['runtimeSecret'], '--output', 'json'))['SecretString'])
    database_url = 'postgresql://{}:{}@{}:5432/moodie'.format(quote(secret['username'], safe=''), quote(secret['password'], safe=''), cfg['databaseHost'])
    values = {
        'NODE_ENV': 'production', 'DATABASE_DRIVER': 'postgres',
        'DATABASE_URL': database_url, 'DATABASE_SSL_MODE': 'verify-full',
        'DATABASE_CA_PATH': '/app/certs/rds-global-bundle.pem',
        'DATABASE_POOL_SIZE': '5', 'PORT': '3001',
        # The only HTTP listener is localhost behind an encrypted SSM tunnel.
        # Switch to true together with a deliberate public HTTPS deployment.
        'COOKIE_SECURE': 'false', 'NODE_OPTIONS': '--max-old-space-size=768',
        'TMDB_API_KEY': secret.get('tmdbApiKey', ''),
    }
    if any('\n' in value or '\r' in value for value in values.values()):
        raise ValueError('Invalid environment value')
    atomic(DIRECTORY / 'app.env', ''.join(f'{key}={value}\n' for key, value in values.items()))


def install():
    cfg = config()
    unit = '''[Unit]
Description=Moodie private development API
Requires=docker.service
After=docker.service network-online.target
StartLimitIntervalSec=0

[Service]
EnvironmentFile=/etc/moodie/release.env
ExecStartPre=-/usr/bin/docker rm -f moodie
ExecStart=/usr/bin/docker run --rm --init --name moodie --read-only --tmpfs /tmp:rw,noexec,nosuid,size=128m,uid=1000,gid=1000 --cap-drop ALL --security-opt no-new-privileges --memory=1500m --memory-swap=1500m --cpus=1.5 --pids-limit=128 --publish 127.0.0.1:3001:3001 --env-file /etc/moodie/app.env --env MOODIE_RELEASE=${MOODIE_RELEASE} --log-driver awslogs --log-opt awslogs-region=REGION --log-opt awslogs-group=LOG_GROUP --log-opt awslogs-stream=api --log-opt mode=non-blocking --log-opt max-buffer-size=4m ${MOODIE_IMAGE}
ExecStop=/usr/bin/docker stop --time 30 moodie
Restart=always
RestartSec=5
TimeoutStopSec=40

[Install]
WantedBy=multi-user.target
'''.replace('REGION', cfg['region']).replace('LOG_GROUP', cfg['logGroup'])
    atomic(Path('/etc/systemd/system/moodie.service'), unit, 0o644)
    atomic(Path('/etc/systemd/system/moodie-health.service'), '''[Unit]
Description=Check Moodie container health and publish capacity metrics
After=moodie.service
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /opt/moodie/hostctl.py health
''', 0o644)
    atomic(Path('/etc/systemd/system/moodie-health.timer'), '''[Unit]
Description=Check Moodie health every minute
[Timer]
OnBootSec=180
OnUnitActiveSec=60
[Install]
WantedBy=timers.target
''', 0o644)
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'enable', 'moodie.service', 'moodie-health.timer'])


def inspect():
    try:
        item = json.loads(run(['docker', 'inspect', 'moodie']))[0]
        return {'running': item['State']['Running'], 'health': item['State'].get('Health', {}).get('Status', 'unknown'), 'image': item['Config']['Image'], 'started': item['State']['StartedAt'], 'oomKilled': item['State']['OOMKilled']}
    except (subprocess.CalledProcessError, IndexError):
        return {'running': False, 'health': 'missing'}


def ready(seconds=100):
    for _ in range(seconds // 2):
        if inspect()['health'] == 'healthy':
            return True
        time.sleep(2)
    return False


def deploy(image):
    cfg = config()
    expected = re.escape(cfg['repository']) + r'@sha256:[a-f0-9]{64}'
    if not re.fullmatch(expected, image):
        raise ValueError('Deploy requires an immutable digest from the Moodie repository')
    password = aws('ecr', 'get-login-password')
    run(['docker', 'login', '--username', 'AWS', '--password-stdin', cfg['repository'].split('/')[0]], input=password)
    run(['docker', 'pull', image])
    environment()
    install()
    release = DIRECTORY / 'release.env'
    old = release.read_text() if release.exists() else None
    digest = image.rsplit(':', 1)[1]
    atomic(release, f'MOODIE_IMAGE={image}\nMOODIE_RELEASE={digest}\n')
    run(['systemctl', 'restart', 'moodie.service'])
    if not ready():
        if old:
            atomic(release, old)
            run(['systemctl', 'restart', 'moodie.service'])
            recovered = ready()
            raise RuntimeError('New release failed; previous release restored=' + str(recovered))
        run(['systemctl', 'stop', 'moodie.service'])
        raise RuntimeError('Initial release did not become healthy; service stopped')
    if old and old != release.read_text():
        atomic(DIRECTORY / 'previous.env', old)
    run(['systemctl', 'start', 'moodie-health.timer'])
    print(json.dumps({'deployed': True, **inspect()}))


def health():
    # Serialize this command with deployment via the same host lock.
    state = inspect()
    if state['health'] == 'unhealthy' and run(['systemctl', 'is-active', 'moodie.service']) == 'active':
        print('Restarting Moodie after repeated container health failures.')
        run(['systemctl', 'restart', 'moodie.service'])
    metrics = [{'MetricName': 'ApiHealthy', 'Value': int(state['health'] == 'healthy'), 'Unit': 'Count'}]
    capacity = os.statvfs('/')
    metrics.append({'MetricName': 'DiskUsedPercent', 'Value': 100 * (1 - capacity.f_bavail / capacity.f_blocks), 'Unit': 'Percent'})
    if state['running']:
        try:
            stats = json.loads(run(['docker', 'stats', '--no-stream', '--format', '{{json .}}', 'moodie']))
            metrics.append({'MetricName': 'ContainerMemoryPercent', 'Value': float(stats['MemPerc'].strip('%')), 'Unit': 'Percent'})
        except (ValueError, subprocess.CalledProcessError):
            pass
    aws('cloudwatch', 'put-metric-data', '--namespace', 'Moodie/Development', '--metric-data', json.dumps(metrics))
    print(json.dumps({'status': state['health'], 'metrics': metrics}))


if __name__ == '__main__':
    import fcntl
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['deploy', 'rollback', 'health', 'status'])
    parser.add_argument('image', nargs='?')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run this host-only command as root.')
    DIRECTORY.mkdir(mode=0o700, exist_ok=True)
    with open('/run/moodie-operations.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            if args.action == 'deploy':
                deploy(args.image or '')
            elif args.action == 'rollback':
                previous = (DIRECTORY / 'previous.env').read_text()
                deploy(next(line.split('=', 1)[1] for line in previous.splitlines() if line.startswith('MOODIE_IMAGE=')))
            elif args.action == 'health':
                health()
            else:
                print(json.dumps(inspect()))
        except Exception as error:
            # Do not emit subprocess arguments, environment, DB URLs or secrets.
            print('Moodie host operation failed: ' + type(error).__name__, file=sys.stderr)
            sys.exit(1)
