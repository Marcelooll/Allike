import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Execute somente no banco local.');
async function api(path,body,method=body?'POST':'GET'){const r=await fetch(base+'/api/'+path,{method,headers:{Cookie:'__sites_local_auth=1',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
let checks=0;function check(name,fn){fn();checks++;console.log('PASS '+name);}
const me=(await api('museum')).data;const initial=(await api('museum?profile=alli')).data;const wasFollowing=!!initial.social.isFollowing;
check('Alli identificado como demonstração',()=>{assert.equal(initial.profile.is_demo,1);assert.equal(initial.profile.avatar,'/alli/mascot-chibi.png');assert.equal(initial.own,false);});
check('três contas explicitamente simuladas',()=>{assert.equal(initial.connections.length,3);assert.ok(initial.connections.every(c=>c.simulated===1));});
check('coleções, conquistas e CSS personalizados',()=>{assert.ok(initial.items.length>=15);assert.ok(initial.items.some(i=>i.kind==='achievement'));assert.ok(initial.profile.css.includes('ARQUIVO NOTURNO'));assert.ok(initial.items.every(i=>i.url.startsWith('https://')));assert.ok(initial.items.every(i=>i.image.startsWith('/alli/real/')));assert.ok(initial.items.some(i=>i.title==='Cult of the Lamb'));assert.ok(initial.items.some(i=>i.title==='A Montanha Sagrada'));assert.ok(initial.items.every(i=>i.provider!=='spotify'));});
const again=(await api('museum?profile=alli')).data;check('inicialização idempotente',()=>assert.equal(again.items.length,initial.items.length));
try{
 await api('follow',{target:'demo:alli',following:false});let feed=(await api('feed?scope=following')).data;check('perfil não seguido não aparece no feed Seguindo',()=>assert.ok(feed.items.every(i=>i.owner!=='demo:alli')));
 const followed=await api('follow',{target:'demo:alli',following:true});check('seguir perfil',()=>assert.equal(followed.status,200));
 await api('follow',{target:'demo:alli',following:true});const following=(await api('social?profile='+me.profile.handle+'&type=following')).data;check('seguir repetidamente não duplica relação',()=>assert.equal(following.people.filter(p=>p.id==='demo:alli').length,1));
 const followers=(await api('social?profile=alli&type=followers')).data;check('seguidor aparece na lista do Alli',()=>assert.ok(followers.people.some(p=>p.id===me.viewer)));
 feed=(await api('feed?scope=following')).data;check('feed usa relações persistentes',()=>assert.ok(feed.items.some(i=>i.owner==='demo:alli'&&i.is_demo===1)));
 const activity=await api('demo/activity',{});check('geração de atividade fictícia',()=>assert.equal(activity.status,200));const updated=(await api('feed?scope=following')).data;check('atividade nova no topo do feed',()=>assert.equal(updated.items[0].id,activity.data.id));
 const self=await api('follow',{target:me.viewer,following:true});check('bloqueio de auto-follow',()=>assert.equal(self.status,400));
 const invalid=await api('follow',{target:'demo:alli',following:'yes'});check('validação de estado de follow',()=>assert.equal(invalid.status,400));
 const missing=await api('follow',{target:'missing-user',following:true});check('perfil inexistente não cria relação',()=>assert.equal(missing.status,404));
 const pin=initial.items[0];await api('pin',{id:pin.id,provider:pin.provider,pinned:!pin.pinned},'PUT');const after=(await api('museum?profile=alli')).data;check('visitante não altera curadoria do mascote',()=>assert.equal(after.items.find(i=>i.id===pin.id).pinned,pin.pinned));
 await api('follow',{target:'demo:alli',following:false});feed=(await api('feed?scope=following')).data;check('deixar de seguir remove atividades desse perfil',()=>assert.ok(feed.items.every(i=>i.owner!=='demo:alli')));
 const discover=(await api('feed?scope=discover')).data;check('Descobrir permanece disponível sem seguir',()=>assert.ok(discover.items.some(i=>i.owner==='demo:alli')));
}finally{await api('follow',{target:'demo:alli',following:wasFollowing});}
console.log(checks+' verificações sociais concluídas.');
