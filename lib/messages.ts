import {database,profile,jsonBody,value,HttpError} from './server';
const reply=(body:unknown)=>Response.json(body,{headers:{'Cache-Control':'no-store'}});
export async function messagesRoute(req:Request){
 const {user}=await profile(),db=database(),url=new URL(req.url),me=user.userId;
 if(req.method==='GET'){
 const peer=url.searchParams.get('peer');
 if(!peer){const rows=await db.prepare(`SELECT p.id,p.name,p.handle,p.avatar,p.is_demo,
 (SELECT body FROM messages WHERE (sender=? AND recipient=p.id) OR (sender=p.id AND recipient=?) ORDER BY created DESC,id DESC LIMIT 1) AS last_body,
 (SELECT MAX(created) FROM messages WHERE (sender=? AND recipient=p.id) OR (sender=p.id AND recipient=?)) AS updated,
 (SELECT COUNT(*) FROM messages WHERE sender=p.id AND recipient=? AND read_at IS NULL) AS unread
 FROM profiles p WHERE p.id<>? AND EXISTS(SELECT 1 FROM messages WHERE (sender=? AND recipient=p.id) OR (sender=p.id AND recipient=?)) ORDER BY updated DESC LIMIT 100`).bind(me,me,me,me,me,me,me,me).all();return reply({conversations:rows.results});}
 const person=await db.prepare('SELECT id,name,handle,avatar,is_demo FROM profiles WHERE id=?').bind(peer).first();if(!person)throw new HttpError(404,'Pessoa não encontrada.');
 const before=url.searchParams.get('before');const boundary=before?await db.prepare('SELECT created,id FROM messages WHERE id=? AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))').bind(before,me,peer,peer,me).first<{created:number;id:string}>():null;
 if(before&&!boundary)throw new HttpError(400,'Página inválida.');
 const sql='SELECT id,sender,recipient,body,created,read_at FROM messages WHERE ((sender=? AND recipient=?) OR (sender=? AND recipient=?))'+(boundary?' AND (created<? OR (created=? AND id<?))':'')+' ORDER BY created DESC,id DESC LIMIT 51';
 const stmt=db.prepare(sql),rows=await(boundary?stmt.bind(me,peer,peer,me,boundary.created,boundary.created,boundary.id):stmt.bind(me,peer,peer,me)).all();
 return reply({peer:person,messages:rows.results.slice(0,50).reverse(),hasMore:rows.results.length>50});
 }
 const body=await jsonBody(req);
 if(req.method==='PUT'){const peer=value(body.peer,200,true);await db.prepare('UPDATE messages SET read_at=? WHERE sender=? AND recipient=? AND read_at IS NULL AND created<=?').bind(Date.now(),peer,me,Math.min(Number(body.until)||0,Date.now())).run();return reply({ok:true});}
 if(req.method==='POST'){
 const peer=value(body.peer,200,true),text=value(body.body,3000,true),id=value(body.id,80,true);if(!/^[a-zA-Z0-9-]{20,80}$/.test(id))throw new HttpError(400,'Identificador inválido.');if(peer===me)throw new HttpError(400,'Escolha outro perfil para conversar.');
 const target=await db.prepare('SELECT is_demo FROM profiles WHERE id=?').bind(peer).first<{is_demo:number}>();if(!target)throw new HttpError(404,'Pessoa não encontrada.');if(target.is_demo)throw new HttpError(400,'Alli é um mascote fictício. Use o mural dele; o chat é para pessoas reais.');
 const existing=await db.prepare('SELECT sender,recipient FROM messages WHERE id=?').bind(id).first();if(existing){if(existing.sender!==me||existing.recipient!==peer)throw new HttpError(409,'Identificador já utilizado.');return reply({ok:true,id});}
 const last=await db.prepare('SELECT MAX(created) AS time FROM messages WHERE sender=?').bind(me).first<{time:number}>();if(last&&last.time>Date.now()-1000)throw new HttpError(429,'Aguarde um segundo entre mensagens.');
 await db.prepare('INSERT INTO messages (id,sender,recipient,body,created) VALUES (?,?,?,?,?)').bind(id,me,peer,text,Date.now()).run();return reply({ok:true,id});
 }
 throw new HttpError(405,'Método não permitido.');
}
