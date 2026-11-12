import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Este teste só pode usar o banco local.');
let passed=0;
async function call(path,method='GET',body,headers={}){const r=await fetch(base+'/api/'+path,{method,headers:{Cookie:'__sites_local_auth=1',...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:r.status,data};}
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const initial=await call('museum');assert.equal(initial.status,200);const original=initial.data.profile;
try{
 const anon=await fetch(base+'/api/museum');check('autenticação obrigatória',()=>assert.equal(anon.status,401));
 const bad=await call('profile','PUT',{...original,handle:'../inválido'});check('validação de endereço',()=>assert.equal(bad.status,400));
 const cross=await call('profile','PUT',original,{Origin:'https://outro-site.invalid'});check('proteção de origem em escrita',()=>assert.equal(cross.status,403));
 const saved=await call('profile','PUT',{...original,name:'Teste de persistência',bio:'Dados locais de teste.'});check('gravação do perfil',()=>assert.equal(saved.status,200));
 const read=await call('museum');check('leitura após gravação',()=>assert.equal(read.data.profile.name,'Teste de persistência'));
 const comment=await call('comments','POST',{owner:original.id,body:'Smoke test '+Date.now()});check('publicação de comentário',()=>assert.equal(comment.status,200));
 const comments=(await call('museum')).data.comments;const added=comments.find(c=>c.body.startsWith('Smoke test '));check('comentário persistente',()=>assert.ok(added));
 await call('comments','DELETE',{id:added.id});check('remoção autorizada de comentário',()=>assert.ok(added));
 const unknown=await call('sync','POST',{provider:'invalid'});check('rejeição de provedor inválido',()=>assert.equal(unknown.status,400));
 const injection=await call('connections','POST',{provider:'letterboxd',account:'https://127.0.0.1'});check('rejeição de URL como usuário',()=>assert.equal(injection.status,400));
 if(process.env.TEST_LIVE_RSS==='1'&&!initial.data.connections.some(c=>c.provider==='letterboxd')){
  const connect=await call('connections','POST',{provider:'letterboxd',account:'jack'});check('importação de RSS real',()=>assert.equal(connect.status,200,JSON.stringify(connect.data)));
  const first=(await call('museum')).data;check('filmes persistidos da fonte externa',()=>assert.ok(first.items.some(i=>i.provider==='letterboxd')));
  const again=await call('sync','POST',{provider:'letterboxd'});check('intervalo mínimo de sincronização',()=>assert.equal(again.data.skipped,true));
  const item=first.items.find(i=>i.provider==='letterboxd');await call('pin','PUT',{provider:item.provider,id:item.id,pinned:true});const pinned=(await call('museum')).data.items.find(i=>i.id===item.id);check('curadoria persistente',()=>assert.equal(pinned.pinned,1));
  await call('connections','DELETE',{provider:'letterboxd'});const clean=(await call('museum')).data;check('desconexão remove somente a coleção alvo',()=>assert.equal(clean.items.filter(i=>i.provider==='letterboxd').length,0));
 }
}finally{await call('profile','PUT',original);if(process.env.TEST_LIVE_RSS==='1'&&!initial.data.connections.some(c=>c.provider==='letterboxd'))await call('connections','DELETE',{provider:'letterboxd'});}
console.log(passed+' verificações concluídas.');
