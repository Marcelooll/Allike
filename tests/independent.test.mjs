import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {independentRequest} from '../lib/independent-request.mjs';

test('independent hosting rejects missing auth and strips forged Sites identities',async()=>{
 const request=new Request('https://allike.example/api/museum',{method:'POST',headers:{'oai-authenticated-user-id':'forged-admin','oai-authenticated-user-email':'fake@example.com',cookie:'allike_session=opaque','Content-Type':'application/json'},body:'{"name":"test"}'});
 assert.equal(independentRequest(request,{}).status,503);
 assert.equal(independentRequest(request,{AUTH_PROVIDER:'chatgpt'}).status,503);
 const safe=independentRequest(request,{AUTH_PROVIDER:'admin'});
 assert.equal(safe.headers.get('oai-authenticated-user-id'),null);
 assert.equal(safe.headers.get('oai-authenticated-user-email'),null);
 assert.equal(safe.headers.get('cookie'),'allike_session=opaque');
 assert.equal(safe.method,'POST');assert.deepEqual(await safe.json(),{name:'test'});
});

test('all migrations create a usable independent database from zero',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
  for(const table of ['profiles','items','connections','comments','follows','messages','auth_sessions','auth_limits','oauth'])assert.ok(tables.includes(table),table);
  db.prepare('INSERT INTO profiles (id,name,handle,created) VALUES (?,?,?,?)').run('test','Teste','test',1);
  assert.equal(db.prepare('SELECT is_demo FROM profiles WHERE id=?').get('test').is_demo,0);
  assert.throws(()=>db.prepare('INSERT INTO profiles (id,name,handle,created) VALUES (?,?,?,?)').run('other','Other','test',1));
 }finally{db.close();}
});
