import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

// Execute the real account route with an in-memory D1 adapter and a fake Auth service.
// No credentials, emails, network or production data are used.
test('Supabase adapter: verification, session lifetime, renewal and revocation',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE auth_sessions(id TEXT PRIMARY KEY,tokens TEXT,expires INTEGER,access_expires INTEGER,user_id TEXT NOT NULL DEFAULT "");CREATE TABLE auth_limits(id TEXT PRIMARY KEY,count INTEGER,expires INTEGER)');
 const database=()=>({prepare(query){let values=[];const obj={bind(...v){values=v;return obj;},async first(){return sql.prepare(query).get(...values)||null;},async run(){return sql.prepare(query).run(...values);}};return obj;},async batch(stmts){return Promise.all(stmts.map(s=>s.run()));}});
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 const digest=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('base64url');
 let cookie='',confirmed=true,lastCall;const calls=[];const realFetch=globalThis.fetch;
 const user=()=>({id:'test-user',email:'test@example.com',email_confirmed_at:confirmed?'2026-01-01':null,user_metadata:{name:'Teste'}});
 globalThis.fetch=async(url,init)=>{lastCall={url,init};calls.push(lastCall);const path=new URL(url).pathname;const body=path.endsWith('/user')?user():path.endsWith('/signup')||path.endsWith('/resend')?{user:user()}:{access_token:'fake-access',refresh_token:'fake-refresh',expires_in:3600,user:user()};return Response.json(body);};
 globalThis.__accountDeps={headers:async()=>new Headers({cookie}),database,config:()=>({AUTH_PROVIDER:'supabase',SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'public-test-key',TOKEN_SECRET:'test-only'}),digest,b64:a=>Buffer.from(a).toString('base64url'),encrypt:async s=>'encrypted:'+Buffer.from(s).toString('base64'),decrypt:async s=>Buffer.from(s.slice(10),'base64').toString(),HttpError,jsonBody:async r=>{if(r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin)throw new HttpError(403,'Origem inválida');return r.json();},value:(v,max,required)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new HttpError(400,'Inválido');return v.trim();}};
 const source=readFileSync(new URL('../lib/account.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const compiled=ts.transpileModule('const {headers,database,config,digest,b64,encrypt,decrypt,HttpError,jsonBody,value}=globalThis.__accountDeps;\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 try{
 const {accountRoute,accountIdentity}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const request=(body,extra={})=>new Request('https://allike.example/api/auth/test',{method:'POST',headers:{'Content-Type':'application/json',cookie,...extra},body:JSON.stringify(body)});
 const input={email:'test@example.com',password:'correct horse battery',remember:false};
 await accountRoute(request({...input,name:'Teste'}),'auth/signup');assert.ok(lastCall.url.endsWith('/signup'));assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,0,'signup never creates session');
 confirmed=false;await assert.rejects(accountRoute(request(input),'auth/login'),e=>e.status===403);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,0);
 confirmed=true;const login=await accountRoute(request(input),'auth/login');const transient=login.headers.get('set-cookie');assert.match(transient,/HttpOnly/);assert.match(transient,/Secure/);assert.match(transient,/SameSite=Lax/);assert.doesNotMatch(transient,/Max-Age/);cookie=transient.split(';')[0];
 let record=sql.prepare('SELECT * FROM auth_sessions').get();assert.ok(record.expires-Date.now()<=12*3600000);assert.ok(!record.tokens.includes(input.password));assert.notEqual(record.id,cookie.split('=')[1]);
 assert.equal((await accountIdentity()).userId,'supabase:test-user');assert.ok(lastCall.url.endsWith('/user'),'identity validated with provider');
 sql.prepare('UPDATE auth_sessions SET access_expires=0').run();await accountIdentity();assert.ok(calls.some(c=>c.url.endsWith('token?grant_type=refresh_token')));
 const remembered=await accountRoute(request({...input,remember:true}),'auth/login');assert.match(remembered.headers.get('set-cookie'),/Max-Age=2592000/);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,1,'session rotation removes previous session');cookie=remembered.headers.get('set-cookie').split(';')[0];
 await accountRoute(request({email:input.email,code:'123456',remember:false}),'auth/verify');assert.equal(JSON.parse(lastCall.init.body).type,'signup');assert.equal(JSON.parse(lastCall.init.body).token,'123456');
 await assert.rejects(accountRoute(request({...input,code:'abc'}),'auth/verify'),e=>e.status===400);
 await assert.rejects(accountRoute(request(input,{Origin:'https://evil.example'}),'auth/login'),e=>e.status===403);
 const fresh=await accountRoute(request(input),'auth/login');cookie=fresh.headers.get('set-cookie').split(';')[0];const logout=await accountRoute(request({}),'auth/logout');assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);assert.equal(await accountIdentity(),null);

 // Password recovery must require a recovery code, never signup verification or just an email.
 sql.prepare('DELETE FROM auth_limits').run();
 cookie='';
 const before=await accountRoute(request(input),'auth/login');cookie=before.headers.get('set-cookie').split(';')[0];
 sql.prepare('INSERT INTO auth_sessions(id,tokens,expires,access_expires,user_id) VALUES (?,?,?,?,?)').run('other-session','opaque',Date.now()+100000,Date.now()+100000,'supabase:other');
 const previousFetch=globalThis.fetch;let consumed=false,failRecovery=false;
 globalThis.fetch=async(url,init)=>{
  const data=init.body?JSON.parse(init.body):{};
  if(url.endsWith('/recover')&&failRecovery)return Response.json({error:'not found'},{status:400});
  if(url.endsWith('/verify')&&data.type==='recovery'){
   if(data.token!=='654321'||consumed)return Response.json({error:'invalid or expired'},{status:400});
   consumed=true;
  }
  return previousFetch(url,init);
 };
 const recovery={email:input.email,code:'654321',password:'a new synthetic password',confirmPassword:'a new synthetic password'};
 const existing=await accountRoute(request({email:input.email}),'auth/forgot');failRecovery=true;
 const absent=await accountRoute(request({email:'missing@example.com'}),'auth/forgot');failRecovery=false;
 assert.deepEqual(await existing.json(),await absent.json(),'do not enumerate registered emails');
 await assert.rejects(accountRoute(request({...recovery,confirmPassword:'mismatch'}),'auth/reset'),e=>e.status===400);
 await assert.rejects(accountRoute(request({...recovery,code:'123456'}),'auth/reset'),e=>e.status===400);
 assert.equal(consumed,false);
 await assert.rejects(accountRoute(request(recovery,{Origin:'https://evil.example'}),'auth/reset'),e=>e.status===403);
 const reset=await accountRoute(request(recovery),'auth/reset');
 assert.match(reset.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal(lastCall.init.method,'PUT');assert.equal(JSON.parse(lastCall.init.body).password,recovery.password);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_sessions WHERE user_id=?').get('supabase:test-user').n,0);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_sessions WHERE user_id=?').get('supabase:other').n,1);
 assert.equal(await accountIdentity(),null);
 await assert.rejects(accountRoute(request(recovery),'auth/reset'),e=>e.status===400,'recovery code cannot be replayed');
 const newLogin=await accountRoute(request(input),'auth/login');cookie=newLogin.headers.get('set-cookie').split(';')[0];
 const allOut=await accountRoute(request({}),'auth/logout-all');assert.match(allOut.headers.get('set-cookie'),/Max-Age=0/);assert.equal(await accountIdentity(),null);
 await assert.rejects(accountRoute(request({}),'auth/logout-all'),e=>e.status===401);

 }finally{globalThis.fetch=realFetch;delete globalThis.__accountDeps;sql.close();}
});
