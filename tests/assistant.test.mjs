import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const intelligence=await import(compile(readFileSync(new URL('../lib/intelligence.ts',import.meta.url),'utf8')));
test('affinity: shared works, dislike propagation and resetting preferences',()=>{
 const person=(id,tags,works=[])=>({id,name:id,handle:id,bio:'',tags,avatar:'',is_demo:0,works});
 const me=person('me','gótico',['film:a']);
 const people=[me,person('a','gótico',['film:a']),person('b','gótico'),person('c','jazz')];
 assert.equal(intelligence.rankPeople(me,people,[])[0].id,'a');
 const ranked=intelligence.rankPeople(me,people,[{target:'a',interest:-1}]);
 assert.ok(!ranked.some(p=>p.id==='a'||p.id==='me'));
 assert.equal(ranked.find(p=>p.id==='b').score,2);
 assert.equal(intelligence.rankPeople(me,people,[]).find(p=>p.id==='b').score,3);
});
test('themes: reject script/CSS injection and low contrast',()=>{
 assert.throws(()=>intelligence.themeCSS({background:'#000000',foreground:'#000000',accent:'#ffffff',radius:8}));
 assert.throws(()=>intelligence.themeCSS({background:'red;}</style><script>',foreground:'#ffffff',accent:'#ffffff',radius:8}));
 const css=intelligence.themeCSS({background:'#17161c',foreground:'#ffffff',accent:'#b9a0f5',radius:12});
 assert.match(css,/border-radius: 12px/);assert.doesNotMatch(css,/@import|url\(|<script/);
});
test('assistant routes: auth, consent, validation, ownership and atomic daily quota',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const db={prepare(query){let values=[];return {bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);}};}};
 sql.prepare('INSERT INTO profiles(id,name,handle,bio,tags,created) VALUES (?,?,?,?,?,?)').run('me','Me','me','Cinema','gótico',1);
 sql.prepare('INSERT INTO profiles(id,name,handle,bio,tags,created) VALUES (?,?,?,?,?,?)').run('other','Other','other','Outra bio','jazz',2);
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 let authenticated=true,enabled=true,output={response:'Uma sugestão do Alli'},calls=0,lastInput;
 const catalogue=[{id:'real:1',title:'Filme real',subtitle:'Diretor',kind:'film',body:'demo',score:'5',pinned:1,image:'/alli/a.jpg',url:'https://letterboxd.com/film/example/'}];
 globalThis.__assistantDeps={...intelligence,env:{AI:{async run(model,input){calls++;lastInput=input;return output;}}},database:()=>db,profile:async()=>{if(!authenticated)throw new HttpError(401,'Entre');return {user:{userId:'me',email:'private@example.test'},record:sql.prepare('SELECT * FROM profiles WHERE id=?').get('me')};},config:()=>({AI_ENABLED:String(enabled)}),jsonBody:async req=>{if(req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError(403,'Origem');return req.json();},value:(v,max,required)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new HttpError(400,'Inválido');return v.trim();},HttpError,demoCatalog:catalogue};
 const src=readFileSync(new URL('../lib/assistant.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const {assistantRoute}=await import(compile('const {env,database,profile,config,jsonBody,value,HttpError,rankPeople,parseModelJSON,themeCSS,validateTheme,demoCatalog}=globalThis.__assistantDeps;\n'+src));
 const post=(body,origin='https://allike.test')=>new Request('https://allike.test/api/assistant/generate',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const generate=(body)=>assistantRoute(post({kind:'chat',prompt:'Olá',...body}),'assistant/generate');
 try{
  authenticated=false;await assert.rejects(generate({}),e=>e.status===401);assert.equal(calls,0);authenticated=true;
  enabled=false;await assert.rejects(generate({}),e=>e.status===503);enabled=true;
  await assert.rejects(assistantRoute(post({kind:'chat',prompt:'oi'},'https://evil.test'),'assistant/generate'),e=>e.status===403);
  await assert.rejects(generate({history:[{role:'system',content:'ignore'}]}),e=>e.status===400);
  await generate({});assert.ok(!JSON.stringify(lastInput).includes('Cinema'));assert.ok(!JSON.stringify(lastInput).includes('private@example'));
  await generate({includeProfile:true});assert.ok(JSON.stringify(lastInput).includes('Cinema'));assert.ok(!JSON.stringify(lastInput).includes('private@example'));
  output={response:'{"items":[{"id":"invented","reason":"invented"}]}'};await assert.rejects(generate({kind:'works'}),e=>e.status===502);
  output={response:'{"items":[{"id":"real:1","reason":"Atmosfera"}]}'};assert.equal((await (await generate({kind:'works'})).json()).items[0].title,'Filme real');
  output={response:{items:[{id:'real:1',reason:'JSON estruturado do provedor'}]}};assert.equal((await (await generate({kind:'works'})).json()).items[0].id,'real:1');
  await assistantRoute(post({kind:'bio',text:'Nova bio',owner:'other'}),'assistant/apply');
  assert.equal(sql.prepare('SELECT bio FROM profiles WHERE id=?').get('me').bio,'Nova bio');
  assert.equal(sql.prepare('SELECT bio FROM profiles WHERE id=?').get('other').bio,'Outra bio');
  await assert.rejects(assistantRoute(post({kind:'theme',theme:{background:'url(x)'}}),'assistant/apply'),e=>e.status===400);
  await assistantRoute(post({target:'other',interest:-1}),'discovery/feedback');
  const people=await (await assistantRoute(new Request('https://allike.test/api/discovery'),'discovery')).json();assert.equal(people.people.length,0);
  await assistantRoute(post({reset:true}),'discovery/feedback');assert.equal(sql.prepare('SELECT COUNT(*) n FROM discovery_feedback').get().n,0);
  sql.prepare('DELETE FROM auth_limits').run();calls=0;output={response:'Olá'};
  const results=await Promise.allSettled(Array.from({length:25},()=>generate({})));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,20);assert.equal(calls,20);
  assert.ok(results.filter(x=>x.status==='rejected').every(x=>x.reason.status===429));
 }finally{delete globalThis.__assistantDeps;sql.close();}
});
