import {env} from 'cloudflare:workers';
import {alliRoomCSS} from './alli-theme';
import {demoCatalog} from './demo-data';
export {demoCatalog};
export const ALLI_ID='demo:alli';
export async function ensureAlli(){
 const db=env.DB!;
 const existing=await db.prepare('SELECT css,avatar,is_demo FROM profiles WHERE id=?').bind(ALLI_ID).first<{css:string;avatar:string;is_demo:number}>();
 if(existing&&existing.is_demo!==1)return;
 const current=existing&&await db.prepare('SELECT id FROM items WHERE owner=? AND id=?').bind(ALLI_ID,'real:film:the-holy-mountain').first();
 if(current){if(existing!.css!==alliRoomCSS||existing!.avatar!=='/alli/mascot-chibi.png')await db.prepare('UPDATE profiles SET css=?,avatar=? WHERE id=? AND is_demo=1').bind(alliRoomCSS,'/alli/mascot-chibi.png',ALLI_ID).run();return;}
 const now=Date.now();
 // Replace only the mascot's catalogue. Preserve follows and visitor comments.
 await db.batch([
 db.prepare('INSERT OR IGNORE INTO profiles (id,name,handle,created,is_demo) VALUES (?,?,?,?,1)').bind(ALLI_ID,'Alli','alli',now),
 db.prepare('UPDATE profiles SET bio=?,tags=?,accent=?,theme=?,css=?,avatar=? WHERE id=? AND is_demo=1').bind('Diabinho de bolso, cinéfilo de madrugada. Entre alquimia no cinema, darkwave no toca-discos e pequenos cultos nos videogames. Meu altar tem vinil, chá e um controle. Obras reais; gostos de um mascote.','cinema esotérico, darkwave, folk horror, jogos indie, vinil','#d8b579','alli',alliRoomCSS,'/alli/mascot-chibi.png',ALLI_ID),
 db.prepare('DELETE FROM items WHERE owner=?').bind(ALLI_ID),
 db.prepare('DELETE FROM connections WHERE owner=?').bind(ALLI_ID),
 ...['steam','letterboxd','lastfm'].map(p=>db.prepare('INSERT INTO connections (owner,provider,account,last_sync,simulated) VALUES (?,?,?,?,1)').bind(ALLI_ID,p,'alli.curadoria',now)),
 ...demoCatalog.map((x,i)=>db.prepare('INSERT INTO items (id,owner,provider,kind,title,subtitle,image,url,body,date,score,pinned) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(x.id,ALLI_ID,x.provider,x.kind,x.title,x.subtitle,x.image,x.url,x.body,now-i*7200000,x.score,x.pinned)),
 db.prepare('INSERT INTO comments (id,owner,author,body,created) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').bind('alli-welcome',ALLI_ID,ALLI_ID,'Bem-vindo ao arquivo noturno. Os filmes, artistas, jogos e conquistas daqui existem de verdade. Eu sou o mascote: minhas opiniões, notas, horas e desbloqueios são parte do personagem. Qual obra você colocaria neste altar?',now)
 ]);
}
