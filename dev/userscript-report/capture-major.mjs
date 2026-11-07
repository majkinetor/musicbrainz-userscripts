// Capture sources for maintainer-submitted verdicts; never decides a verdict.
// Cached bytes remain private; published fingerprints permit later incremental review.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=p=>JSON.parse(readFileSync(path.join(dir,p),'utf8'));
const cache=path.join(dir,'.cache/major');mkdirSync(cache,{recursive:true});
const entries=read('data/catalog.json').entries,manifest=read('data/contributions.json');
const selected=new Map();for(const s of manifest.submissions)for(const item of read('data/'+s.exportPath).entries)selected.set(item.id,item.review.proposedVerdict);
const previous=existsSync(path.join(dir,'data/major-sources.json'))?read('data/major-sources.json'):null;
process.env.GIT_EDITOR='true';process.env.GIT_SEQUENCE_EDITOR='true';process.env.GIT_MERGE_AUTOEDIT='no';
const git=args=>execFileSync('git',args,{cwd:path.resolve(dir,'../..'),maxBuffer:50e6});
const suiteCommit=git(['rev-parse','origin/main']).toString().trim();
const suitePaths=git(['ls-tree','-r','--name-only',suiteCommit,'userscripts','dev/aliases']).toString().trim().split('\n').filter(p=>/\.user\.js$|\/(?:README|DEVELOP)\.md$/.test(p)||p==='dev/aliases/alias-editor.mjs');
const suiteFiles=suitePaths.map(p=>({path:p,sha256:createHash('sha256').update(git(['show',suiteCommit+':'+p])).digest('hex')}));
const toolset={commit:suiteCommit,files:suiteFiles,inventoryHash:createHash('sha256').update(JSON.stringify(suiteFiles)).digest('hex')};
const commits=new Map(),results=[];
for(const entry of entries.filter(e=>selected.has(e.id))){
 const old=previous?.entries.find(e=>e.id===entry.id);if(process.argv.includes('--retry-unavailable')&&old?.state==='captured'&&!['Change All Artists Default','MusicBrainz: Add Spotify & SoundExchange search buttons on ISRC page'].includes(entry.name)){results.push(old);continue;}
 const record={id:entry.id,name:entry.name,maintainerVerdict:selected.get(entry.id),sourceUrl:entry.sourceUrl,downloadUrl:entry.downloadUrl,checkedAt:new Date().toISOString()};
 try{
  let url=entry.downloadUrl;if(entry.name==='Change All Artists Default'){url=entry.sourceUrl.replace('/blob/','/raw/');record.kind='typescript-source';}
  const match=url?.match(/^https:\/\/(?:raw.githubusercontent.com\/([^/]+)\/([^/]+)\/|github.com\/([^/]+)\/([^/]+)\/raw\/)(?:refs\/heads\/)?([^/]+)\/(.+)$/);
  if(match){
   const repo=(match[1]||match[3])+'/'+(match[2]||match[4]),branch=match[5],file=decodeURIComponent(match[6]);
   const key=repo+'/'+branch;
   if(!commits.has(key))commits.set(key,JSON.parse(execFileSync('gh',['api','repos/'+repo+'/commits/'+encodeURIComponent(branch)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})).sha);
   record.commit=commits.get(key);record.repo=repo;record.path=file;
   url='https://raw.githubusercontent.com/'+repo+'/'+record.commit+'/'+file.split('/').map(encodeURIComponent).join('/');
  }
  if(entry.name==='Harmony'){
   const repo='kellnerd/harmony';record.repo=repo;record.path='README.md';
   record.commit=JSON.parse(execFileSync('gh',['api','repos/'+repo+'/commits/HEAD'],{encoding:'utf8'})).sha;
   url='https://raw.githubusercontent.com/'+repo+'/'+record.commit+'/README.md';record.kind='application-readme';
  }
  if(!url)throw new Error('No downloadable source in preserved wiki row');
  // Normalize Greasy Fork pages to the service's code endpoint.
  const gf=(entry.name==='MusicBrainz: Add Spotify & SoundExchange search buttons on ISRC page'?entry.sourceUrl:url).match(/^https:\/\/(?:update\.)?greasyfork.org\/(?:[a-z-]+\/)?scripts\/(\d+)/);
  if(gf){const meta=JSON.parse(execFileSync('curl.exe',['--fail','--location','--silent','--show-error','https://greasyfork.org/scripts/'+gf[1]+'.json'],{encoding:'utf8'}));url=meta.code_url;record.codeUpdatedAt=meta.code_updated_at;record.serviceId=meta.id;}
  if(old?.state==='captured'&&record.commit&&old.commit===record.commit&&old.url===url&&existsSync(path.join(cache,old.sha256+'.txt'))){results.push({...old,checkedAt:record.checkedAt,changedSincePrevious:false});continue;}
  const bytes=execFileSync('curl.exe',['--fail','--location','--silent','--show-error','--max-time','25',url],{maxBuffer:40e6,stdio:['ignore','pipe','pipe']});
  const text=bytes.toString('utf8');
  if(!['application-readme','typescript-source'].includes(record.kind)&&(!text.includes('==UserScript==')||/<html[\s>]/i.test(text.slice(0,300))))throw new Error('Response is not a userscript; needs source-location review');
  record.sha256=createHash('sha256').update(bytes).digest('hex');record.bytes=bytes.length;
  record.version=text.match(/^\/\/\s*@version\s+(.+)$/m)?.[1].trim()||null;
  record.requires=[...text.matchAll(/^\/\/\s*@require\s+(.+)$/gm)].map(m=>m[1]);
  record.url=url;record.evidenceUrl=record.repo?'https://github.com/'+record.repo+'/blob/'+record.commit+'/'+record.path.split('/').map(encodeURIComponent).join('/'):url;
  record.state='captured';record.changedSincePrevious=previous?previous.entries.find(e=>e.id===entry.id)?.sha256!==record.sha256:null;
  writeFileSync(path.join(cache,record.sha256+'.txt'),bytes);
  console.log('Captured '+entry.name+' '+record.sha256.slice(0,8));
 }catch(error){record.state='unavailable';record.reason=(error.stderr?.toString()||error.message).slice(0,300);console.log('Unavailable '+entry.name);}
 results.push(record);
}
writeFileSync(path.join(dir,'data/major-sources.json'),JSON.stringify({schemaVersion:1,toolset,capturedAt:new Date().toISOString(),entries:results},null,2)+'\n');
