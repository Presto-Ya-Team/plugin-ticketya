#!/usr/bin/env python3
"""Publish only own static prefix and enqueue; host owns activation/state."""
import hashlib,json,os,pathlib,subprocess,tempfile,urllib.request
BUCKET='ticketya-production-artifacts-040084234234'
sha=os.environ['RELEASE_SHA']
assert len(sha)==40 and all(c in 'abcdef0123456789' for c in sha)
request=urllib.request.Request('https://api.github.com/repos/Presto-Ya-Team/plugin-ticketya/git/ref/heads/main',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
with urllib.request.urlopen(request,timeout=30) as response:
 assert json.load(response)['object']['sha']==sha,'Source is no longer main; do not enqueue obsolete build'
def aws(args):
 return subprocess.run(['aws',*args,'--region','us-east-1'],check=True,capture_output=True,text=True).stdout
with tempfile.TemporaryDirectory() as directory:
 state=pathlib.Path(directory)/'current.json'
 r=subprocess.run(['aws','s3api','get-object','--bucket',BUCKET,'--key','state/plugin.json',str(state),'--region','us-east-1'],capture_output=True,text=True)
 if r.returncode and 'NoSuchKey' not in r.stderr:raise RuntimeError('Cannot establish current deployment')
 current=json.loads(state.read_text()) if r.returncode==0 else None
 version=hashlib.sha256(pathlib.Path('dist.tgz').read_bytes()).hexdigest()
 aws(['s3api','put-object','--bucket',BUCKET,'--key','releases/plugin/'+sha+'/dist.tgz','--body','dist.tgz','--metadata','sha256='+version])
 value={'product':'ticketya','application_code':'plugin-ticketya','component':'plugin','repository':'Presto-Ya-Team/plugin-ticketya','branch':'main','source_sha':sha,'checks':'passed','version':version,'base_version':current['version'] if current else None}
 path=pathlib.Path(directory)/'queue.json';path.write_text(json.dumps(value))
 aws(['s3api','put-object','--bucket',BUCKET,'--key','queue/plugin.json','--body',str(path),'--content-type','application/json'])
 print(json.dumps({'queued':sha,'archive_sha256':version,'activation':'daily04:00 America/La_Paz or guarded manual executor'}))
