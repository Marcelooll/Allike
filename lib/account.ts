import {headers} from 'next/headers';
import {database,config,digest,b64,encrypt,decrypt,HttpError,jsonBody,value} from './server';
import type {ChatGPTUser} from '@/app/chatgpt-auth';

const COOKIE='allike_session';
export function adminReady(){return config().AUTH_PROVIDER==='admin'&&!!config().ADMIN_USERNAME&&!!config().ADMIN_PASSWORD_HASH&&!!config().TOKEN_SECRET;}
export function accountReady(){return adminReady()|| config().AUTH_PROVIDER==='supabase'&&!!config().SUPABASE_URL&&!!config().SUPABASE_PUBLISHABLE_KEY&&!!config().TOKEN_SECRET;}
const reply=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
function cookieValue(raw:string){return raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function sessionCookie(req:Request,token:string,remember=false,clear=false){return COOKIE+'='+token+'; Path=/; HttpOnly; SameSite=Lax'+(new URL(req.url).protocol==='https:'?'; Secure':'')+(clear?'; Max-Age=0':remember?'; Max-Age=2592000':'');}
async function authFetch(path:string,body?:unknown,access?:string,method=body?'POST':'GET'){
 if(config().AUTH_PROVIDER!=='supabase'||!accountReady())throw new HttpError(503,'O cadastro por e-mail aguarda a configuração do Supabase.');
 const origin=new URL(config().SUPABASE_URL);if(origin.protocol!=='https:')throw new HttpError(503,'Configuração de autenticação inválida.');
 let r:Response;try{r=await fetch(origin.origin+'/auth/v1/'+path,{method,headers:{apikey:config().SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw new HttpError(503,'Não foi possível acessar a autenticação. Tente novamente.');}
 const d:any=await r.json().catch(()=>({}));if(!r.ok){if(r.status===429)throw new HttpError(429,'Muitas tentativas. Aguarde antes de tentar novamente.');if(r.status>=500)throw new HttpError(503,'O serviço de autenticação não conseguiu concluir. Verifique o envio de e-mails e tente novamente.');throw new HttpError(400,path.startsWith('token')?'E-mail ou senha inválidos, ou e-mail ainda não confirmado.':'Não foi possível confirmar os dados. Confira o código, sua validade e a configuração de e-mail.');}return d;
}
async function limit(key:string,max:number){const db=database(),window=Math.floor(Date.now()/900000);const id=await digest(key+':'+window);const row=await db.prepare('INSERT INTO auth_limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,(window+2)*900000).first<{count:number}>();await db.prepare('DELETE FROM auth_limits WHERE expires<?').bind(Date.now()).run();if(Number(row?.count)>max)throw new HttpError(429,'Muitas tentativas. Aguarde 15 minutos.');}
type Session={id:string;tokens:string;expires:number;access_expires:number;user_id:string};
async function sessionUser(token:string):Promise<ChatGPTUser|null>{
 if(!token||!accountReady())return null;const db=database();const id=await digest(token);const s=await db.prepare('SELECT * FROM auth_sessions WHERE id=? AND expires>?').bind(id,Date.now()).first<Session>();if(!s)return null;
 let pair:any=JSON.parse(await decrypt(s.tokens));
 if(pair.kind==='admin'){if(!adminReady()||pair.stamp!==await digest(config().ADMIN_USERNAME+':'+config().ADMIN_PASSWORD_HASH))return null;return {userId:'admin:allike',email:'',fullName:config().ADMIN_USERNAME,displayName:config().ADMIN_USERNAME,role:'admin'};}
 if(config().AUTH_PROVIDER==='admin')return null;
 try{if(s.access_expires<Date.now()+30000){pair={...await authFetch('token?grant_type=refresh_token',{refresh_token:pair.refresh_token}),remember:pair.remember};await db.prepare('UPDATE auth_sessions SET tokens=?,access_expires=? WHERE id=?').bind(await encrypt(JSON.stringify({access_token:pair.access_token,refresh_token:pair.refresh_token,remember:pair.remember})),Date.now()+pair.expires_in*1000,id).run();}
 const u=await authFetch('user',undefined,pair.access_token);if(!u.email_confirmed_at)return null;
 if(!s.user_id)await db.prepare('UPDATE auth_sessions SET user_id=? WHERE id=?').bind('supabase:'+u.id,id).run();
 return {userId:'supabase:'+u.id,email:u.email,fullName:typeof u.user_metadata?.name==='string'?u.user_metadata.name.slice(0,60):null,displayName:'Meu museu'};
 }catch(e){if(e instanceof HttpError&&(e.status===503||e.status===429))throw e;await db.prepare('DELETE FROM auth_sessions WHERE id=?').bind(id).run();return null;}
}
export async function accountIdentity(){return sessionUser(cookieValue((await headers()).get('cookie')||''));}
async function establish(req:Request,d:any,remember:boolean){
 if(!d.user?.email_confirmed_at||!d.access_token||!d.refresh_token)throw new HttpError(403,'Confirme seu e-mail antes de entrar.');
 const db=database(),token=b64(crypto.getRandomValues(new Uint8Array(32))),id=await digest(token);const old=cookieValue(req.headers.get('cookie')||'');
 await db.batch([db.prepare('DELETE FROM auth_sessions WHERE expires<? OR id=?').bind(Date.now(),old?await digest(old):''),db.prepare('INSERT INTO auth_sessions (id,tokens,expires,access_expires,user_id) VALUES (?,?,?,?,?)').bind(id,await encrypt(JSON.stringify({access_token:d.access_token,refresh_token:d.refresh_token,remember})),Date.now()+(remember?30*86400000:12*3600000),Date.now()+d.expires_in*1000,'supabase:'+d.user.id)]);
 return reply({ok:true},200,sessionCookie(req,token,remember));
}
async function sessionDetails(req:Request){const raw=cookieValue(req.headers.get('cookie')||'');if(!raw)return null;const row=await database().prepare('SELECT tokens,expires FROM auth_sessions WHERE id=? AND expires>?').bind(await digest(raw),Date.now()).first<{tokens:string;expires:number}>();if(!row)return null;const payload=JSON.parse(await decrypt(row.tokens));return {remember:payload.remember===true,expires:row.expires};}
export async function accountRoute(req:Request,path:string){
 if(req.method==='GET'&&path==='auth/status'){const user=await accountIdentity();return reply({configured:accountReady(),provider:config().AUTH_PROVIDER==='admin'?'admin':config().AUTH_PROVIDER==='supabase'?'supabase':'chatgpt',user:user?{name:user.fullName,email:user.email,role:user.role||'member'}:null,session:user?await sessionDetails(req):null});}
 if(req.method!=='POST')throw new HttpError(405,'Método não permitido.');const body=await jsonBody(req);
 if(path==='auth/logout'){const raw=cookieValue(req.headers.get('cookie')||'');if(raw)await database().prepare('DELETE FROM auth_sessions WHERE id=?').bind(await digest(raw)).run();return reply({ok:true},200,sessionCookie(req,'',false,true));}
 if(path==='auth/logout-all'){
  const user=await accountIdentity();if(!user)throw new HttpError(401,'Entre novamente para gerenciar suas sessões.');
  await database().prepare("DELETE FROM auth_sessions WHERE user_id=? OR user_id=''").bind(user.userId).run();
  return reply({ok:true},200,sessionCookie(req,'',false,true));
 }
 if(config().AUTH_PROVIDER==='admin'){
  if(!adminReady())throw new HttpError(503,'O acesso administrativo ainda não foi configurado.');
  if(path!=='auth/login')throw new HttpError(403,'A conta administrativa não possui e-mail de recuperação. O mantenedor precisa redefinir o hash da senha na configuração protegida da hospedagem.');
  await limit('admin-ip:'+(req.headers.get('cf-connecting-ip')||'unknown'),12);
  const username=value(body.username,100,true);if(typeof body.password!=='string'||!body.password||body.password.length>128)throw new HttpError(400,'Informe usuário e senha.');
  const [scheme,iterations,salt,expected]=config().ADMIN_PASSWORD_HASH.split('$');
  if(scheme!=='pbkdf2-sha256'||iterations!=='100000'||!salt||!expected)throw new HttpError(503,'Configuração administrativa inválida.');
  const decode=(v:string)=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(body.password),'PBKDF2',false,['deriveBits']);
  const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:decode(salt),iterations:100000},key,256));
  const target=decode(expected);let diff=actual.length^target.length;for(let i=0;i<actual.length;i++)diff|=actual[i]^(target[i]||0);
  if(diff!==0||username!==config().ADMIN_USERNAME)throw new HttpError(401,'Usuário ou senha incorretos.');
  const token=b64(crypto.getRandomValues(new Uint8Array(32))),id=await digest(token),old=cookieValue(req.headers.get('cookie')||'');const remember=body.remember===true;
  const expires=Date.now()+(remember?30*86400000:12*3600000);
  await database().batch([database().prepare('DELETE FROM auth_sessions WHERE expires<? OR id=?').bind(Date.now(),old?await digest(old):''),database().prepare('INSERT INTO auth_sessions (id,tokens,expires,access_expires,user_id) VALUES (?,?,?,?,?)').bind(id,await encrypt(JSON.stringify({kind:'admin',stamp:await digest(config().ADMIN_USERNAME+':'+config().ADMIN_PASSWORD_HASH),remember})),expires,expires,'admin:allike')]);
  return reply({ok:true,role:'admin'},200,sessionCookie(req,token,remember));
 }
 if(!accountReady())throw new HttpError(503,'O cadastro por e-mail aguarda a configuração do Supabase.');
 const email=value(body.email,254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Informe um e-mail válido.');
 await limit('email:'+email,12);await limit('ip:'+(req.headers.get('cf-connecting-ip')||'unknown'),60);
 if(path==='auth/forgot'){
  await limit('recovery:'+email,3);
  try{await authFetch('recover',{email});}catch(e){if(!(e instanceof HttpError)||e.status!==400)throw e;}
  return reply({ok:true,message:'Se existir uma conta para esse e-mail, você receberá um código de recuperação. Confira também o spam.'});
 }
 if(path==='auth/reset'){
  const code=value(body.code,10,true);if(!/^\d{6,10}$/.test(code))throw new HttpError(400,'Informe o código de recuperação recebido por e-mail.');
  if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new HttpError(400,'Use uma senha de 12 a 128 caracteres.');
  if(body.password!==body.confirmPassword)throw new HttpError(400,'As senhas precisam ser iguais.');
  const verified=await authFetch('verify',{email,token:code,type:'recovery'});
  if(!verified.access_token||!verified.user?.id||!verified.user.email_confirmed_at)throw new HttpError(403,'Não foi possível confirmar a recuperação.');
  await authFetch('user',{password:body.password},verified.access_token,'PUT');
  await database().prepare("DELETE FROM auth_sessions WHERE user_id=? OR user_id=''").bind('supabase:'+verified.user.id).run();
  return reply({ok:true,message:'Senha atualizada. Suas sessões anteriores no Allike foram encerradas. Entre com a nova senha.'},200,sessionCookie(req,'',false,true));
 }
 if(path==='auth/signup'){const name=value(body.name,60,true);if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new HttpError(400,'Use uma senha de 12 a 128 caracteres.');await authFetch('signup',{email,password:body.password,data:{name}});return reply({ok:true,message:'Se o endereço puder ser cadastrado, você receberá um código. Confira também o spam. Se já tem conta, entre com sua senha.'});}
 if(path==='auth/login'){if(typeof body.password!=='string'||!body.password||body.password.length>128)throw new HttpError(400,'Informe sua senha.');return establish(req,await authFetch('token?grant_type=password',{email,password:body.password}),body.remember===true);}
 if(path==='auth/verify'){const code=value(body.code,10,true);if(!/^\d{6,10}$/.test(code))throw new HttpError(400,'Confira o código enviado ao seu e-mail.');return establish(req,await authFetch('verify',{email,token:code,type:'signup'}),body.remember===true);}
 if(path==='auth/resend'){await authFetch('resend',{type:'signup',email});return reply({ok:true,message:'Se houver uma confirmação pendente, um novo código será enviado.'});}
 throw new HttpError(404,'Operação não encontrada.');
}
