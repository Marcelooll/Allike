import {env} from 'cloudflare:workers';
import {alliRoomCSS} from './alli-theme';
export const ALLI_ID='demo:alli';
import {demoCatalog} from './demo-data';
export {demoCatalog};
export async function ensureAlli(){const db=env.DB!;const existing=await db.prepare('SELECT css,avatar,is_demo FROM profiles WHERE id=?').bind(ALLI_ID).first<{css:string;avatar:string;is_demo:number}>();if(existing){if(existing.is_demo===1&&(existing.css!==alliRoomCSS||existing.avatar!=='/alli/mascot-chibi.png'))await db.prepare('UPDATE profiles SET css=?,avatar=? WHERE id=? AND is_demo=1').bind(alliRoomCSS,'/alli/mascot-chibi.png',ALLI_ID).run();return;}
 const now=Date.now();await db.batch([
 db.prepare('INSERT OR IGNORE INTO profiles (id,name,handle,bio,tags,accent,theme,css,created,avatar,is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,1)').bind(ALLI_ID,'Alli','alli','Pequeno demônio, grandes obsessões. Coleciono filmes que parecem sonhos, discos com chiado e mundos onde dá vontade de ficar. Entre, o chá já está pronto.','dream pop, cinema noturno, jogos indie, vinil, mundos imaginários','#d8b579','alli',alliRoomCSS,now,'/alli/mascot-chibi.png'),
 ...['steam','letterboxd','spotify','lastfm'].map(p=>db.prepare('INSERT OR IGNORE INTO connections (owner,provider,account,last_sync,simulated) VALUES (?,?,?,?,1)').bind(ALLI_ID,p,'alli.imaginario',now)),
 ...demoCatalog.map((x,i)=>db.prepare('INSERT OR IGNORE INTO items (id,owner,provider,kind,title,subtitle,image,url,body,date,score,pinned) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(x.id,ALLI_ID,x.provider,x.kind,x.title,x.subtitle,'/alli/'+x.art+'.svg','',x.body,now-i*7200000,x.score,x.pinned)),
 db.prepare('INSERT OR IGNORE INTO comments (id,owner,author,body,created) VALUES (?,?,?,?,?)').bind('alli-welcome',ALLI_ID,ALLI_ID,'Bem-vindo ao meu cantinho. Sou o mascote de demonstração do Allike: minhas contas, obras e histórias são inventadas. Mas a conversa que começa aqui pode ser real. Qual objeto você levaria deste museu?',now)
 ]);
}
