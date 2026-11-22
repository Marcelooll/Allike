import {database,config,decrypt,encrypt,identity,jsonBody,value,HttpError} from './server';
export async function serviceKey(provider:'steam'|'lastfm'){
 const configured=config()[provider==='steam'?'STEAM_API_KEY':'LASTFM_API_KEY'];if(configured)return configured;
 const saved=await database().prepare('SELECT encrypted_key FROM integration_secrets WHERE provider=?').bind(provider).first<{encrypted_key:string}>();
 return saved?decrypt(saved.encrypted_key):'';
}
export async function configureSteam(req:Request){
 const user=await identity();if(user.role!=='admin')throw new HttpError(403,'Somente o mantenedor pode configurar a integração.');
 if(req.method!=='POST')throw new HttpError(405,'Método não permitido.');
 const body=await jsonBody(req),key=value(body.key,32,true);if(!/^[0-9a-f]{32}$/i.test(key))throw new HttpError(400,'Confira a chave Steam Web API: são 32 caracteres hexadecimais.');
 const connection=await database().prepare("SELECT account FROM connections WHERE owner=? AND provider='steam'").bind(user.userId).first<{account:string}>();
 if(!connection)throw new HttpError(409,'Vincule sua Steam antes de validar a configuração.');
 let response:Response;try{response=await fetch('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?'+new URLSearchParams({key,steamid:connection.account}),{signal:AbortSignal.timeout(18000),redirect:'error'});}catch{throw new HttpError(502,'Não foi possível validar a chave com a Steam. Tente novamente.');}
 if(!response.ok)throw new HttpError(400,'A Steam não aceitou a chave. Confira se ela está ativa.');
 await database().prepare('INSERT INTO integration_secrets(provider,encrypted_key,updated) VALUES (?,?,?) ON CONFLICT(provider) DO UPDATE SET encrypted_key=excluded.encrypted_key,updated=excluded.updated').bind('steam',await encrypt(key),Date.now()).run();
 return Response.json({ok:true,message:'Integração Steam ativada. Agora você pode sincronizar sua biblioteca.'},{headers:{'Cache-Control':'no-store'}});
}
