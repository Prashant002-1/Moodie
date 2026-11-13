#!/usr/bin/env python3
"""Private Moodie deployment and local access using the owner's existing SSO."""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / '.aws'
ACCOUNT = 'YOUR_AWS_ACCOUNT_ID'


def command(args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs).stdout.strip()


class Moodie:
    def __init__(self, profile='atlas-sso-admin', region='us-east-1', stack='moodie-dev'):
        self.base = ['aws', '--profile', profile, '--region', region]
        self.region, self.stack = region, stack
        if self.aws('sts', 'get-caller-identity')['Account'] != ACCOUNT:
            raise RuntimeError('Wrong AWS account. Stopped before mutation.')
        self.outputs = {v['OutputKey']: v['OutputValue'] for v in self.aws('cloudformation', 'describe-stacks', '--stack-name', stack)['Stacks'][0].get('Outputs', [])}

    def aws(self, *args):
        result = command(self.base + list(args) + ['--output', 'json'])
        return json.loads(result) if result else {}

    def shell(self, commands, timeout=600):
        item = self.aws('ssm', 'send-command', '--instance-ids', self.outputs['InstanceId'], '--document-name', 'AWS-RunShellScript', '--timeout-seconds', str(timeout), '--parameters', json.dumps({'commands': commands, 'executionTimeout': [str(timeout)]}))
        identifier = item['Command']['CommandId']
        print('SSM command ' + identifier, flush=True)
        deadline = time.monotonic() + timeout + 60
        while time.monotonic() < deadline:
            time.sleep(3)
            try:
                result = self.aws('ssm', 'get-command-invocation', '--command-id', identifier, '--instance-id', self.outputs['InstanceId'])
            except subprocess.CalledProcessError as error:
                if 'InvocationDoesNotExist' in (error.stderr or ''):
                    continue
                raise
            if result['Status'] in ['Pending', 'InProgress', 'Delayed']:
                continue
            print(result.get('StandardOutputContent', ''), end='', flush=True)
            if result['Status'] != 'Success':
                print(result.get('StandardErrorContent', ''), flush=True)
                raise RuntimeError('SSM operation finished with ' + result['Status'])
            return result
        raise TimeoutError('SSM observation timed out; inspect the existing command ' + identifier + ' before retrying.')

    def tunnel(self, database=False, local_port=None):
        plugin = STATE / 'tools'
        environment = dict(os.environ, PATH=str(plugin) + os.pathsep + os.environ.get('PATH', ''))
        if database:
            document = 'AWS-StartPortForwardingSessionToRemoteHost'
            parameters = {'host': [self.outputs['DatabaseHost']], 'portNumber': ['5432'], 'localPortNumber': [str(local_port or 15432)]}
        else:
            document = 'AWS-StartPortForwardingSession'
            parameters = {'portNumber': ['3001'], 'localPortNumber': [str(local_port or 3301)]}
            print('Open http://127.0.0.1:' + parameters['localPortNumber'][0] + ' after the tunnel connects.', flush=True)
        try:
            subprocess.run(self.base + ['ssm', 'start-session', '--target', self.outputs['InstanceId'], '--document-name', document, '--parameters', json.dumps(parameters)], env=environment, check=True)
        except KeyboardInterrupt:
            print('Tunnel closed.', flush=True)

    def deploy(self, tag=None):
        # Hash exactly the source areas admitted by the build, never .env/.data.
        paths = [ROOT / p for p in ['Dockerfile', '.dockerignore', 'package.json', 'package-lock.json']]
        for directory in ['server/src', 'src', 'public', 'database/migrations', 'certs', 'ops/runtime', 'docs/api']:
            paths.extend(p for p in (ROOT / directory).rglob('*') if p.is_file())
        paths.extend(ROOT / p for p in ['server/package.json', 'server/tsconfig.json', 'database/schema.sql', 'index.html', 'vite.config.ts', 'postcss.config.js', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json'])
        digest = hashlib.sha256()
        for path in sorted(set(paths)):
            digest.update(str(path.relative_to(ROOT)).encode() + b'\0' + path.read_bytes())
        source_hash = digest.hexdigest()
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        tag = tag or stamp + '-' + source_hash[:12]
        repository = self.outputs['RepositoryUri']
        image = repository + ':' + tag
        subprocess.run(['docker', 'build', '--platform', 'linux/arm64', '--provenance=false', '--target', 'runtime', '--label', 'io.moodie.source-sha256=' + source_hash, '--tag', image, '.'], cwd=ROOT, check=True)
        password = command(self.base + ['ecr', 'get-login-password'])
        command(['docker', 'login', '--username', 'AWS', '--password-stdin', repository.split('/')[0]], input=password)
        subprocess.run(['docker', 'push', image], check=True)
        image_digest = self.aws('ecr', 'describe-images', '--repository-name', 'moodie-dev/api', '--image-ids', 'imageTag=' + tag)['imageDetails'][0]['imageDigest']
        reference = repository + '@' + image_digest
        cfg = {'region': self.region, 'repository': repository, 'databaseHost': self.outputs['DatabaseHost'], 'runtimeSecret': self.outputs['RuntimeSecretArn'], 'logGroup': self.outputs['AppLogGroup']}
        script = base64.b64encode((ROOT / 'infra/aws/hostctl.py').read_bytes()).decode()
        encoded_config = base64.b64encode(json.dumps(cfg).encode()).decode()
        self.shell(['set -eu', 'install -d -m 0700 /etc/moodie', 'install -d -m 0755 /opt/moodie', f'printf %s {shlex.quote(script)} | base64 -d > /opt/moodie/hostctl.py', f'printf %s {shlex.quote(encoded_config)} | base64 -d > /etc/moodie/config.json', 'chmod 0600 /etc/moodie/config.json', 'python3 /opt/moodie/hostctl.py deploy ' + shlex.quote(reference)])
        STATE.mkdir(exist_ok=True)
        record = {'stack': self.stack, 'region': self.region, 'image': reference, 'tag': tag, 'sourceSha256': source_hash, 'deployedAt': stamp, 'outputs': self.outputs}
        (STATE / 'deployment.json').write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps({k: record[k] for k in ['image', 'sourceSha256', 'deployedAt']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['outputs', 'tunnel', 'database-tunnel', 'deploy', 'rollback', 'status'])
    parser.add_argument('--profile', default='atlas-sso-admin')
    parser.add_argument('--region', default='us-east-1')
    parser.add_argument('--stack', default='moodie-dev')
    parser.add_argument('--local-port', type=int)
    parser.add_argument('--tag')
    args = parser.parse_args()
    moodie = Moodie(args.profile, args.region, args.stack)
    if args.action == 'outputs':
        print(json.dumps(moodie.outputs, indent=2))
    elif args.action in ['tunnel', 'database-tunnel']:
        moodie.tunnel(args.action == 'database-tunnel', args.local_port)
    elif args.action == 'deploy':
        moodie.deploy(args.tag)
    else:
        moodie.shell(['python3 /opt/moodie/hostctl.py ' + args.action])
