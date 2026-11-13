import {headers} from 'next/headers';
import {database,config,digest,b64,encrypt,decrypt,HttpError,jsonBody,value} from './server';
import type {ChatGPTUser} from '@/app/chatgpt-auth';

const COOKIE='allike_session';
export function accountReady(){return config().AUTH_PROVIDER==='supabase'&&!!config().SUPABASE_URL&&!!config().SUPABASE_PUBLISHABLE_KEY&&!!config().TOKEN_SECRET;}
const reply=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
function cookieValue(raw:string){return raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function sessionCookie(req:Request,token:string,remember=false,clear=false){return COOKIE+'='+token+'; Path=/; HttpOnly; SameSite=Lax'+(new URL(req.url).protocol==='https:'?'; Secure':'')+(clear?'; Max-Age=0':remember?'; Max-Age=2592000':'');}
async function authFetch(path:string,body?:unknown,access?:string,method=body?'POST':'GET'){
 if(!accountReady())throw new HttpError(503,'O cadastro por e-mail aguarda a configuração do Supabase.');
 const origin=new URL(config().SUPABASE_URL);if(origin.protocol!=='https:')throw new HttpError(503,'Configuração de autenticação inválida.');
 let r:Response;try{r=await fetch(origin.origin+'/auth/v1/'+path,{method,headers:{apikey:config().SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw new HttpError(503,'Não foi possível acessar a autenticação. Tente novamente.');}
 const d:any=await r.json().catch(()=>({}));if(!r.ok){if(r.status===429)throw new HttpError(429,'Muitas tentativas. Aguarde antes de tentar novamente.');if(r.status>=500)throw new HttpError(503,'O serviço de autenticação não conseguiu concluir. Verifique o envio de e-mails e tente novamente.');throw new HttpError(400,path.startsWith('token')?'E-mail ou senha inválidos, ou e-mail ainda não confirmado.':'Não foi possível confirmar os dados. Confira o código, sua validade e a configuração de e-mail.');}return d;
}
async function limit(key:string,max:number){const db=database(),window=Math.floor(Date.now()/900000);const id=await digest(key+':'+window);const row=await db.prepare('INSERT INTO auth_limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,(window+2)*900000).first<{count:number}>();await db.prepare('DELETE FROM auth_limits WHERE expires<?').bind(Date.now()).run();if(Number(row?.count)>max)throw new HttpError(429,'Muitas tentativas. Aguarde 15 minutos.');}
type Session={id:string;tokens:string;expires:number;access_expires:number};
async function sessionUser(token:string):Promise<ChatGPTUser|null>{
 if(!token||!accountReady())return null;const db=database();const id=await digest(token);const s=await db.prepare('SELECT * FROM auth_sessions WHERE id=? AND expires>?').bind(id,Date.now()).first<Session>();if(!s)return null;
 let pair:any=JSON.parse(await decrypt(s.tokens));
 try{if(s.access_expires<Date.now()+30000){pair=await authFetch('token?grant_type=refresh_token',{refresh_token:pair.refresh_token});await db.prepare('UPDATE auth_sessions SET tokens=?,access_expires=? WHERE id=?').bind(await encrypt(JSON.stringify({access_token:pair.access_token,refresh_token:pair.refresh_token})),Date.now()+pair.expires_in*1000,id).run();}
 const u=await authFetch('user',undefined,pair.access_token);if(!u.email_confirmed_at)return null;return {userId:'supabase:'+u.id,email:u.email,fullName:typeof u.user_metadata?.name==='string'?u.user_metadata.name.slice(0,60):null,displayName:'Meu museu'};
 }catch(e){if(e instanceof HttpError&&(e.status===503||e.status===429))throw e;await db.prepare('DELETE FROM auth_sessions WHERE id=?').bind(id).run();return null;}
}
export async function accountIdentity(){return sessionUser(cookieValue((await headers()).get('cookie')||''));}
async function establish(req:Request,d:any,remember:boolean){
 if(!d.user?.email_confirmed_at||!d.access_token||!d.refresh_token)throw new HttpError(403,'Confirme seu e-mail antes de entrar.');
 const db=database(),token=b64(crypto.getRandomValues(new Uint8Array(32))),id=await digest(token);const old=cookieValue(req.headers.get('cookie')||'');
 await db.batch([db.prepare('DELETE FROM auth_sessions WHERE expires<? OR id=?').bind(Date.now(),old?await digest(old):''),db.prepare('INSERT INTO auth_sessions (id,tokens,expires,access_expires) VALUES (?,?,?,?)').bind(id,await encrypt(JSON.stringify({access_token:d.access_token,refresh_token:d.refresh_token})),Date.now()+(remember?30*86400000:12*3600000),Date.now()+d.expires_in*1000)]);
 return reply({ok:true},200,sessionCookie(req,token,remember));
}
export async function accountRoute(req:Request,path:string){
 if(req.method==='GET'&&path==='auth/status'){const user=await accountIdentity();return reply({configured:accountReady(),provider:accountReady()?'supabase':'chatgpt',user:user?{name:user.fullName,email:user.email}:null});}
 if(req.method!=='POST')throw new HttpError(405,'Método não permitido.');const body=await jsonBody(req);
 if(path==='auth/logout'){const raw=cookieValue(req.headers.get('cookie')||'');if(raw)await database().prepare('DELETE FROM auth_sessions WHERE id=?').bind(await digest(raw)).run();return reply({ok:true},200,sessionCookie(req,'',false,true));}
 if(!accountReady())throw new HttpError(503,'O cadastro por e-mail aguarda a configuração do Supabase.');
 const email=value(body.email,254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Informe um e-mail válido.');
 await limit('email:'+email,12);await limit('ip:'+(req.headers.get('cf-connecting-ip')||'unknown'),60);
 if(path==='auth/signup'){const name=value(body.name,60,true);if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new HttpError(400,'Use uma senha de 12 a 128 caracteres.');await authFetch('signup',{email,password:body.password,data:{name}});return reply({ok:true,message:'Se o endereço puder ser cadastrado, você receberá um código. Confira também o spam. Se já tem conta, entre com sua senha.'});}
 if(path==='auth/login'){if(typeof body.password!=='string'||!body.password||body.password.length>128)throw new HttpError(400,'Informe sua senha.');return establish(req,await authFetch('token?grant_type=password',{email,password:body.password}),body.remember===true);}
 if(path==='auth/verify'){const code=value(body.code,10,true);if(!/^\d{6,10}$/.test(code))throw new HttpError(400,'Confira o código enviado ao seu e-mail.');return establish(req,await authFetch('verify',{email,token:code,type:'signup'}),body.remember===true);}
 if(path==='auth/resend'){await authFetch('resend',{type:'signup',email});return reply({ok:true,message:'Se houver uma confirmação pendente, um novo código será enviado.'});}
 throw new HttpError(404,'Operação não encontrada.');
}
