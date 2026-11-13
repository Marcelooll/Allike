import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Somente banco local.');
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const file=readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite');
const db=new DatabaseSync(dir+'/'+file);db.exec('PRAGMA busy_timeout=5000');
const a='qa-chat-'+crypto.randomUUID(),b='qa-chat-'+crypto.randomUUID();
async function api(path,body,method=body?'POST':'GET',auth=true){const r=await fetch(base+'/api/'+path,{method,headers:{...(auth?{Cookie:'__sites_local_auth=1'}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
let checks=0;function check(name,fn){fn();checks++;console.log('PASS '+name);}
try{
 for(const id of [a,b])db.prepare('INSERT INTO profiles (id,name,handle,created) VALUES (?,?,?,?)').run(id,'Pessoa de teste',id,Date.now());
 const secret='private-'+crypto.randomUUID();db.prepare('INSERT INTO messages(id,sender,recipient,body,created) VALUES (?,?,?,?,?)').run(secret,a,b,'Mensagem privada de terceiros',Date.now());
 check('chat exige autenticação',()=>{});assert.equal((await api('messages',undefined,'GET',false)).status,401);
 const me=(await api('museum')).data.viewer;
 check('não lê conversa entre terceiros',()=>assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE id=?').get(secret).n,1));
 const before=await api('messages?peer='+a);assert.equal(before.data.messages.some(m=>m.id===secret),false);
 const id=crypto.randomUUID();const sent=await api('messages',{peer:a,body:'Olá, teste de persistência <script>literal</script>',id});check('envio persistente',()=>assert.equal(sent.status,200));
 const duplicate=await api('messages',{peer:a,body:'Mesmo envio repetido',id});check('repetição não duplica mensagem',()=>{assert.equal(duplicate.status,200);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE id=?').get(id).n,1);});
 const thread=await api('messages?peer='+a);check('conversa correta e texto preservado',()=>assert.ok(thread.data.messages.some(m=>m.id===id&&m.body.includes('<script>literal</script>'))));
 const incoming=crypto.randomUUID();db.prepare('INSERT INTO messages(id,sender,recipient,body,created) VALUES (?,?,?,?,?)').run(incoming,a,me,'Resposta recebida',Date.now());
 const list=await api('messages');check('indicador de não lida',()=>assert.equal(list.data.conversations.find(p=>p.id===a).unread,1));
 await api('messages',{peer:a,until:Date.now()},'PUT');check('marcação de leitura',()=>assert.ok(db.prepare('SELECT read_at FROM messages WHERE id=?').get(incoming).read_at));
 check('leitura não altera terceiros',()=>assert.equal(db.prepare('SELECT read_at FROM messages WHERE id=?').get(secret).read_at,null));
 check('mascote não finge chat humano',()=>{});assert.equal((await api('messages',{peer:'demo:alli',body:'oi',id:crypto.randomUUID()})).status,400);
 assert.equal((await api('messages',{peer:me,body:'oi',id:crypto.randomUUID()})).status,400);checks++;console.log('PASS bloqueio de conversa consigo mesmo');
 assert.equal((await api('messages',{peer:a,body:' ',id:crypto.randomUUID()})).status,400);checks++;console.log('PASS mensagem vazia rejeitada');
 assert.equal((await api('messages?peer='+a+'&before='+secret)).status,400);checks++;console.log('PASS cursor de outra conversa rejeitado');
 for(let i=0;i<55;i++)db.prepare('INSERT INTO messages(id,sender,recipient,body,created) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),a,me,'Histórico '+i,Date.now()-100000-i*1000);
 const page=(await api('messages?peer='+a)).data;check('paginação limita a 50 e indica anteriores',()=>{assert.equal(page.messages.length,50);assert.equal(page.hasMore,true);});
 const older=(await api('messages?peer='+a+'&before='+page.messages[0].id)).data;check('paginação sem repetição',()=>{assert.ok(older.messages.length>0);assert.ok(older.messages.every(m=>!page.messages.some(x=>x.id===m.id)));});
 const status=(await api('auth/status')).data;check('configuração ausente não finge autenticação ativa',()=>assert.equal(status.configured,false));
 assert.equal((await api('auth/signup',{email:'qa@example.com',password:'not-a-real-password',name:'Teste'})).status,503);checks++;console.log('PASS cadastro desativado sem provedor');
 const csrf=await fetch(base+'/api/messages',{method:'POST',headers:{Cookie:'__sites_local_auth=1',Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({peer:a,body:'não enviar',id:crypto.randomUUID()})});check('origem externa rejeitada',()=>assert.equal(csrf.status,403));
 const comment=await api('comments',{owner:a,body:'Comentário de teste'});check('comentário no perfil',()=>assert.equal(comment.status,200));const wall=(await api('comments?owner='+a)).data;check('mural consulta comentário persistido',()=>assert.ok(wall.some(c=>c.body==='Comentário de teste')));
}finally{for(const id of [a,b]){db.prepare('DELETE FROM messages WHERE sender=? OR recipient=?').run(id,id);db.prepare('DELETE FROM comments WHERE owner=? OR author=?').run(id,id);db.prepare('DELETE FROM profiles WHERE id=?').run(id);}db.close();}
console.log(checks+' verificações de chat, mural e configuração.');
