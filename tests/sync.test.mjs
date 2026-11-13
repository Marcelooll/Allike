import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

test('Steam/Last.fm: official response mapping and checkpoint after persistence',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE connections(owner TEXT,provider TEXT,account TEXT,token TEXT,last_sync INTEGER,attempted INTEGER,cursor INTEGER,simulated INTEGER,error TEXT,PRIMARY KEY(owner,provider))');
 const database=()=>({prepare(query){let values=[];const s={bind(...v){values=v;return s;},async first(){return db.prepare(query).get(...values)||null;},async run(){const result=db.prepare(query).run(...values);return {meta:{changes:result.changes}};}};return s;}});
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 let saved=[],failSave=false,privateSteam=false;const calls=[],originalFetch=globalThis.fetch;
 globalThis.fetch=async(raw)=>{const url=new URL(raw);calls.push(url);let data;
 if(url.pathname.includes('GetOwnedGames'))data={response:privateSteam?{}:{game_count:1,games:[{appid:367520,name:'Hollow Knight',playtime_forever:120,rtime_last_played:1700000000}]}};
 else if(url.pathname.includes('GetPlayerAchievements'))data={playerstats:{achievements:[{apiname:'CHARMED',achieved:1,unlocktime:1700000000}]}};
 else if(url.pathname.includes('GetSchemaForGame'))data={game:{availableGameStats:{achievements:[{name:'CHARMED',displayName:'Charmed',icon:'https://example.test/icon.jpg',description:'Acquire your first Charm'}]}}};
 else if(url.searchParams.get('method')==='user.getRecentTracks')data={recenttracks:{track:url.searchParams.has('to')?[]:[{name:'Persephone',artist:{'#text':'Cocteau Twins'},album:{'#text':'Treasure'},date:{uts:'1700000000'},image:[{'#text':'https://example.test/treasure.jpg'}],url:'https://www.last.fm/music/Cocteau+Twins/_/Persephone'}]}};
 else if(url.searchParams.get('method')==='user.getTopArtists')data={topartists:{artist:[{name:'Cocteau Twins',playcount:'12',url:'https://www.last.fm/music/Cocteau+Twins',image:[]}]}};
 else throw Error('Unexpected endpoint '+url.pathname);
 return Response.json(data);
 };
 globalThis.__syncDeps={database,config:()=>({STEAM_API_KEY:'test-steam-key',LASTFM_API_KEY:'test-lastfm-key'}),external:(url)=>fetch(url),HttpError,saveEntries:async(_,entries)=>{if(failSave)throw Error('storage failure');saved=entries;},parseLetterboxd:()=>[]};
 const source=readFileSync(new URL('../lib/sync.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.env.DEV','false');
 const compiled=ts.transpileModule('const {database,config,external,HttpError,saveEntries,parseLetterboxd}=globalThis.__syncDeps;\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 try{
 const {syncOne}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 for(const p of ['steam','lastfm'])db.prepare('INSERT INTO connections VALUES (?,?,?,NULL,0,0,0,0,NULL)').run('test',p,p==='steam'?'76561198000000000':'test');
 const steam=await syncOne('test','steam');assert.equal(steam.count,2);assert.equal(saved.find(x=>x.kind==='game').score,'120');assert.equal(saved.find(x=>x.kind==='achievement').title,'Charmed');assert.ok(calls.some(u=>u.searchParams.get('key')==='test-steam-key'));
 db.prepare("UPDATE connections SET attempted=0 WHERE provider='steam'").run();privateSteam=true;await assert.rejects(syncOne('test','steam'),e=>e.status===409);assert.equal(saved.length,2,'private profile does not erase existing entries');
 const fm=await syncOne('test','lastfm');assert.equal(fm.count,2);assert.equal(saved.find(x=>x.kind==='music').title,'Persephone');assert.equal(saved.find(x=>x.kind==='music').image,'https://example.test/treasure.jpg');assert.equal(db.prepare("SELECT cursor FROM connections WHERE provider='lastfm'").get().cursor,-1);
 db.prepare("UPDATE connections SET attempted=0,cursor=1700000000 WHERE provider='lastfm'").run();failSave=true;await assert.rejects(syncOne('test','lastfm'));assert.equal(db.prepare("SELECT cursor FROM connections WHERE provider='lastfm'").get().cursor,1700000000,'checkpoint preserved after storage failure');
 await assert.rejects(syncOne('test','spotify'),e=>e.status===400);
 }finally{globalThis.fetch=originalFetch;delete globalThis.__syncDeps;db.close();}
});
