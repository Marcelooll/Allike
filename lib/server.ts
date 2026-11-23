import {ensureAlli} from './demo';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {safeUrl,type Entry} from './catalog';
import {filmURL} from './letterboxd-import';
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export const config=()=>env as unknown as Record<string,string>;
export function database(){if(!env.DB)throw new HttpError(503,'Banco de dados indisponível.');return env.DB;}
export async function identity(){const {accountIdentity}=await import('./account');const u=(config().AUTH_PROVIDER==='admin'||config().AUTH_PROVIDER==='supabase')?await accountIdentity():await getChatGPTUser();if(!u)throw new HttpError(401,'Entre para abrir seu museu.');return u;}
export async function profile(){const user=await identity();await ensureAlli();const db=database();await db.prepare('INSERT OR IGNORE INTO profiles (id,name,handle,created) VALUES (?,?,?,?)').bind(user.userId,user.fullName||'Meu museu','museu-'+(await digest(user.userId)).slice(0,12).toLowerCase(),Date.now()).run();return {user,record:await db.prepare('SELECT * FROM profiles WHERE id=?').bind(user.userId).first()};}
export async function jsonBody(req:Request,maxBytes=20000){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError(403,'Origem inválida.');const reader=req.body?.getReader();let text='',size=0;const decoder=new TextDecoder();if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'Conteúdo muito grande.');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();try{const body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{throw new HttpError(400,'Dados inválidos.');}}
export function value(v:unknown,max:number,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new HttpError(400,'Verifique os campos e o limite de caracteres.');return v.trim();}
export const bytes=(s:string)=>new TextEncoder().encode(s);
export const b64=(a:Uint8Array)=>btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function digest(s:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(s))));}
async function key(){const secret=config().TOKEN_SECRET;if(!secret)throw new HttpError(503,'A criptografia das conexões ainda não foi configurada.');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',bytes(secret)),'AES-GCM',false,['encrypt','decrypt']);}
export async function encrypt(s:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),bytes(s)));return b64(iv)+'.'+b64(data);}
export async function decrypt(s:string){const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));const [iv,data]=s.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await key(),decode(data)));}
export async function external(url:string,init:RequestInit={}){const r=await fetch(url,{...init,signal:AbortSignal.timeout(18000),redirect:'manual'});if(!r.ok)throw new HttpError(502,r.status===429?'O serviço limitou as consultas. Tente novamente em alguns minutos.':`O serviço externo respondeu com erro ${r.status}. Verifique a conta e as permissões.`);return r;}
export async function saveEntries(owner:string,list:Entry[]){
 const db=database();const known=new Map<string,string>();
 if(list.some(x=>x.provider==='letterboxd')){
  const rows=await db.prepare("SELECT id,url FROM items WHERE owner=? AND provider='letterboxd' ORDER BY date DESC").bind(owner).all<{id:string;url:string}>();
  for(const row of rows.results){const url=filmURL(row.url);if(url&&!known.has(url))known.set(url,row.id);}
 }
 const normalized=list.map(x=>{if(x.provider!=='letterboxd')return x;const url=filmURL(x.url);const id=known.get(url)||x.id;if(url)known.set(url,id);return {...x,id};});
 for(let i=0;i<normalized.length;i+=50)await db.batch(normalized.slice(i,i+50).map(x=>db.prepare("INSERT INTO items (id,owner,provider,kind,title,subtitle,image,url,body,date,score,liked) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,provider,id) DO UPDATE SET liked=COALESCE(?,items.liked),title=excluded.title,subtitle=excluded.subtitle,image=CASE WHEN excluded.image<>'' THEN excluded.image ELSE items.image END,url=excluded.url,body=CASE WHEN excluded.body<>'' AND (excluded.date>=items.date OR items.body='') THEN excluded.body ELSE items.body END,date=MAX(items.date,excluded.date),score=CASE WHEN excluded.score<>'' AND (excluded.date>=items.date OR items.score='') THEN excluded.score ELSE items.score END").bind(x.id,owner,x.provider,x.kind,x.title,x.subtitle,safeUrl(x.image),safeUrl(x.url),x.body,x.date,x.score,x.liked??0,x.liked??null)));
}
