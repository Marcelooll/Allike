import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {pbkdf2Sync,randomBytes} from 'node:crypto';

// Execute the real account route with an in-memory D1 adapter and a fake Auth service.
// No credentials, emails, network or production data are used.
test('Admin: password, sessions, logout and limits',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE auth_sessions(id TEXT PRIMARY KEY,tokens TEXT,expires INTEGER,access_expires INTEGER,user_id TEXT NOT NULL DEFAULT "");CREATE TABLE auth_limits(id TEXT PRIMARY KEY,count INTEGER,expires INTEGER)');
 const database=()=>({prepare(query){let values=[];const obj={bind(...v){values=v;return obj;},async first(){return sql.prepare(query).get(...values)||null;},async run(){return sql.prepare(query).run(...values);}};return obj;},async batch(stmts){return Promise.all(stmts.map(s=>s.run()));}});
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 const digest=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('base64url');
 let cookie='',confirmed=true,lastCall;const calls=[];const realFetch=globalThis.fetch;
 const user=()=>({id:'test-user',email:'test@example.com',email_confirmed_at:confirmed?'2026-01-01':null,user_metadata:{name:'Teste'}});
 globalThis.fetch=async(url,init)=>{lastCall={url,init};calls.push(lastCall);const path=new URL(url).pathname;const body=path.endsWith('/user')?user():path.endsWith('/signup')||path.endsWith('/resend')?{user:user()}:{access_token:'fake-access',refresh_token:'fake-refresh',expires_in:3600,user:user()};return Response.json(body);};
 const salt=randomBytes(16), password='synthetic-test-password', settings={AUTH_PROVIDER:'admin',ADMIN_USERNAME:'test-admin',ADMIN_PASSWORD_HASH:'pbkdf2-sha256$100000$'+salt.toString('base64url')+'$'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url'),TOKEN_SECRET:'test-only'};
 globalThis.__accountDeps={headers:async()=>new Headers({cookie}),database,config:()=>settings,digest,b64:a=>Buffer.from(a).toString('base64url'),encrypt:async s=>'encrypted:'+Buffer.from(s).toString('base64'),decrypt:async s=>Buffer.from(s.slice(10),'base64').toString(),HttpError,jsonBody:async r=>{if(r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin)throw new HttpError(403,'Origem inválida');return r.json();},value:(v,max,required)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new HttpError(400,'Inválido');return v.trim();}};
 const source=readFileSync(new URL('../lib/account.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const compiled=ts.transpileModule('const {headers,database,config,digest,b64,encrypt,decrypt,HttpError,jsonBody,value}=globalThis.__accountDeps;\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 try{
 const {accountRoute,accountIdentity}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const req=(body,extra={})=>new Request('https://allike.example/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',cookie,...extra},body:JSON.stringify(body)});
 const input={username:'test-admin',password,remember:false};
 await assert.rejects(accountRoute(req({...input,password:'wrong'}),'auth/login'),e=>e.status===401);
 await assert.rejects(accountRoute(req({...input,username:'wrong'}),'auth/login'),e=>e.status===401);
 const login=await accountRoute(req(input),'auth/login');const session=login.headers.get('set-cookie');
 assert.match(session,/HttpOnly/);assert.match(session,/Secure/);assert.match(session,/SameSite=Lax/);assert.doesNotMatch(session,/Max-Age/);cookie=session.split(';')[0];
 assert.equal((await accountIdentity()).role,'admin');
 const status=await (await accountRoute(new Request('https://allike.example/api/auth/status',{headers:{cookie}}),'auth/status')).json();assert.equal(status.session.remember,false);assert.ok(status.session.expires-Date.now()<=12*3600000);
 const remembered=await accountRoute(req({...input,remember:true}),'auth/login');assert.match(remembered.headers.get('set-cookie'),/Max-Age=2592000/);cookie=remembered.headers.get('set-cookie').split(';')[0];
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,1);
 assert.equal((await accountIdentity()).userId,'admin:allike');assert.equal((await accountIdentity()).role,'admin');
 const logout=await accountRoute(req({}),'auth/logout');assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);assert.equal(await accountIdentity(),null);
 const fresh=await accountRoute(req(input),'auth/login');cookie=fresh.headers.get('set-cookie').split(';')[0];sql.prepare('UPDATE auth_sessions SET expires=0').run();assert.equal(await accountIdentity(),null);
 await assert.rejects(accountRoute(req(input,{Origin:'https://evil.example'}),'auth/login'),e=>e.status===403);
 await assert.rejects(accountRoute(req(input),'auth/signup'),e=>e.status===403);
 for(let i=0;i<7;i++)await assert.rejects(accountRoute(req({...input,password:'wrong'}),'auth/login'),e=>e.status===401);
 await assert.rejects(accountRoute(req(input),'auth/login'),e=>e.status===429);
 assert.equal(calls.length,0,'admin auth never calls an external service');
 }finally{globalThis.fetch=realFetch;delete globalThis.__accountDeps;sql.close();}
});
