"""Publish one verified preproduction static artifact; the own host owns activation."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

BUCKET = 'prestaya-preproduction-artifacts-040084234234'
ORIGIN = 'https://preprod-api-tickets.prestaya-latam.com'


def candidate(env, tree, digest, base=None):
    if env.get('GITHUB_REF') != 'refs/heads/dev' or env.get('GITHUB_EVENT_NAME') != 'push' or env.get('VITE_TICKET_API_BASE_URL') != ORIGIN:
        raise ValueError('Only the exact preproduction dev build can publish')
    if not re.fullmatch('[a-f0-9]{40}', env.get('RELEASE_SHA', '')) or not re.fullmatch('[a-f0-9]{40}', tree) or not re.fullmatch('[a-f0-9]{64}', digest) or not re.fullmatch('[0-9]+', env.get('GITHUB_RUN_ID', '')):
        raise ValueError('Exact source, tree, archive and CI identity required')
    return dict(product='plugin', deploymentEnvironment='preproduction', branch='dev', repository='Presto-Ya-Team/plugin-ticketya',
                sourceSha=env['RELEASE_SHA'], sourceTree=tree, verificationRunId=env['GITHUB_RUN_ID'], checks='passed',
                artifactSha256=digest, apiOrigin=ORIGIN, baseArtifactSha256=base)


def aws(args):
    return subprocess.run(['aws', 's3api', *args, '--region', 'us-east-1'], capture_output=True, text=True, timeout=90)


def main():
    sha = os.environ['RELEASE_SHA']
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() != sha:
        raise ValueError('Checkout/source mismatch')
    tree = subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], text=True).strip()
    value = candidate(os.environ, tree, hashlib.sha256(Path('dist.tgz').read_bytes()).hexdigest())
    request = urllib.request.Request('https://api.github.com/repos/Presto-Ya-Team/plugin-ticketya/git/ref/heads/dev',
        headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'User-Agent': 'TicketYa-preproduction-publisher'})
    def is_current():
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)['object']['sha'] == sha
    if not is_current():
        print('Newer dev retained; no queue replacement.'); return
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        def get(key, name):
            path = root / name
            result = aws(['get-object', '--bucket', BUCKET, '--key', key, str(path)])
            if result.returncode and 'NoSuchKey' not in result.stderr:
                raise RuntimeError('Unknown preproduction publication base; reconcile key')
            return (json.loads(path.read_text()), json.loads(result.stdout)['ETag']) if not result.returncode else (None, None)
        state, _ = get('state/plugin.json', 'state.json')
        if state and state.get('artifactSha256') == value['artifactSha256']:
            print('Already deployed; no queue replacement.'); return
        value['baseArtifactSha256'] = state.get('artifactSha256') if state else None
        _, etag = get('queue/plugin.json', 'queue.json')
        key = 'releases/plugin/' + sha + '/dist.tgz'
        result = aws(['put-object', '--bucket', BUCKET, '--key', key, '--body', 'dist.tgz',
                      '--metadata', 'sha256=' + value['artifactSha256'], '--server-side-encryption', 'AES256', '--if-none-match', '*'])
        if result.returncode:
            if 'PreconditionFailed' not in result.stderr:
                raise RuntimeError('Unknown immutable artifact publication; reconcile exact key')
            head = aws(['head-object', '--bucket', BUCKET, '--key', key])
            if head.returncode or json.loads(head.stdout).get('Metadata', {}).get('sha256') != value['artifactSha256']:
                raise ValueError('Immutable artifact conflict')
        if not is_current():
            print('Newer dev retained; artifact kept without queue replacement.'); return
        path = root / 'candidate.json'; path.write_text(json.dumps(value))
        queued = aws(['put-object', '--bucket', BUCKET, '--key', 'queue/plugin.json', '--body', str(path),
                      '--server-side-encryption', 'AES256'] + (['--if-match', etag] if etag else ['--if-none-match', '*']))
        if queued.returncode:
            raise RuntimeError('Queue result unknown/conflicting; reconcile exact key before retry')
    print(json.dumps({'queuedSourceSha': sha, 'artifactSha256': value['artifactSha256'], 'activated': False}))


if __name__ == '__main__':
    main()
