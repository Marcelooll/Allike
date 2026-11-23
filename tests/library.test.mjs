import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

async function moduleFile(file,deps={}){
 const name='testDeps'+crypto.randomUUID().replaceAll('-','');globalThis[name]=deps;
 const source=readFileSync(new URL('../lib/'+file,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const compiled=ts.transpileModule('const {'+Object.keys(deps).join(',')+'}=globalThis.'+name+';\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 try{return await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));}finally{delete globalThis[name];}
}
test('CSV, persistence and public collection: real SQL, pagination and privacy',async()=>{
 const catalog=await moduleFile('catalog.ts');
 const publicFilms=await moduleFile('letterboxd-public.ts',{plain:catalog.plain,safeUrl:catalog.safeUrl});
 const markup='<title>Member films • Letterboxd</title><section class="poster-grid"><ul><li class="griditem"><div data-item-slug="donnie-darko" data-item-name="Donnie Darko (2001)"><img src="https://example.com/empty-poster.png"></div><span class="rated-8"></span><span class="liked-micro"></span></li></ul></section><a href="/member/films/page/2/">Next</a>';
 const parsed=publicFilms.parsePublicFilms(markup,'member');assert.equal(parsed.items[0].title,'Donnie Darko');assert.equal(parsed.items[0].score,'4');assert.equal(parsed.items[0].liked,1);assert.equal(parsed.items[0].date,0);assert.equal(parsed.items[0].image,'');assert.equal(parsed.hasNext,true);assert.throws(()=>publicFilms.parsePublicFilms('<title>Just a moment...</title>','member'));
 const csv=await moduleFile('letterboxd-import.ts',{plain:catalog.plain});
 const header='Date,Name,Year,Letterboxd URI,Rating,Review\r\n';
 const sample=header+'2020-01-01,"Film, One",2000,https://letterboxd.com/film/one/,4.5,"A review, with ""quotes""\nand a newline"';
 const films=csv.importFilms(sample);assert.equal(films[0].title,'Film, One');assert.equal(films[0].score,'4.5');assert.match(films[0].body,/quotes/);
 assert.throws(()=>csv.importFilms(sample.replace('https://letterboxd.com/film/one/','javascript:alert(1)')));
 assert.throws(()=>csv.csvRows('Name\n"unfinished'));
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const database=()=>({prepare(sql){let values=[];const q={bind(...args){values=args;return q;},async all(){return {results:db.prepare(sql).all(...values)};},async first(){return db.prepare(sql).get(...values)||null;},async run(){return {meta:{changes:db.prepare(sql).run(...values).changes}};}};return q;},async batch(queries){return Promise.all(queries.map(q=>q.run()));}});
 const server=await moduleFile('server.ts',{env:{DB:database()},ensureAlli:async()=>{},getChatGPTUser:async()=>null,safeUrl:catalog.safeUrl,filmURL:csv.filmURL});
 try{
  db.prepare('INSERT INTO profiles(id,name,handle,created,is_public) VALUES(?,?,?,?,?)').run('owner','Owner','owner',1,1);
  db.prepare('INSERT INTO profiles(id,name,handle,created) VALUES(?,?,?,?)').run('private','Private','private',1);
  await server.saveEntries('owner',films.map(x=>({...x,liked:1})));
  db.prepare('UPDATE items SET pinned=1').run();
  await server.saveEntries('owner',[{...films[0],id:'rss-new',image:'https://example.com/poster.jpg',date:films[0].date+1,body:'',score:''}]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM items').get().n,1);
  const saved=db.prepare('SELECT * FROM items').get();assert.equal(saved.pinned,1);assert.equal(saved.liked,1);assert.equal(saved.score,'4.5');assert.match(saved.body,/quotes/);assert.match(saved.image,/poster/);
  await server.saveEntries('owner',Array.from({length:130},(_,n)=>({...films[0],id:String(n),provider:'steam',kind:'game',title:n===0?'100% complete':'Game '+n,score:String(n),url:'https://store.steampowered.com/app/'+n})));
  let user=null;
  const identity=async()=>{if(!user)throw new server.HttpError(401,'Login');return user;};
  const profile=async()=>({user:await identity(),record:db.prepare('SELECT * FROM profiles WHERE id=?').get(user.userId)});
  const library=await moduleFile('library.ts',{...server,database,identity,profile,serviceKey:async()=>'',importFilms:csv.importFilms});
  const request=(query)=>new Request('https://allike.test/api/collection?profile=owner&'+query);
  let all=[];let offset=0;do{const page=await(await library.libraryRoute(request('kind=game&offset='+offset),'collection')).json();assert.equal(page.total,130);all.push(...page.items);offset=page.nextOffset;}while(offset!==null);
  assert.equal(all.length,130);assert.equal(new Set(all.map(x=>x.id)).size,130);
  const search=await(await library.libraryRoute(request('q=%25'),'collection')).json();assert.equal(search.total,1,'SQL LIKE wildcard escaped');
  await assert.rejects(library.resolveMuseum(new Request('https://allike.test/?profile=private')),e=>e.status===401);
  const publicData=await(await library.museumResponse(request(''))).json();assert.equal(publicData.guest,true);assert.deepEqual(publicData.comments,[]);assert.equal(publicData.viewerProfile,null);assert.equal(publicData.canConfigureServices,false);assert.equal(publicData.stats.minutes,8385);
  user={userId:'owner',role:'admin'};
  await assert.rejects(library.libraryRoute(new Request('https://allike.test/api/imports/letterboxd',{method:'POST',body:JSON.stringify({csv:sample})}),'imports/letterboxd'),e=>e.status===409);
  db.prepare('INSERT INTO connections(owner,provider,account) VALUES(?,?,?)').run('owner','letterboxd','owner');
  const result=await library.libraryRoute(new Request('https://allike.test/api/imports/letterboxd',{method:'POST',body:JSON.stringify({csv:sample})}),'imports/letterboxd');assert.equal(result.status,200);assert.equal(db.prepare("SELECT COUNT(*) n FROM items WHERE provider='letterboxd'").get().n,1);
  await assert.rejects(server.jsonBody(new Request('https://allike.test/',{method:'POST',body:'x'.repeat(50)}),10),e=>e.status===413);
 }finally{db.close();}
});
