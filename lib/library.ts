import {database,profile,identity,jsonBody,value,HttpError,saveEntries} from './server';
import {serviceKey} from './integrations';
import {importFilms} from './letterboxd-import';
type MuseumProfile={id:string;handle:string;name:string;is_public:number;is_demo:number;[key:string]:unknown};
export async function resolveMuseum(req:Request){
 const handle=new URL(req.url).searchParams.get('profile');
 if(!handle){const me=await profile();return {record:me.record as MuseumProfile,me,guest:false};}
 const record=await database().prepare('SELECT * FROM profiles WHERE handle=?').bind(handle).first<MuseumProfile>();
 if(!record)throw new HttpError(404,'Museu não encontrado.');
 let user;try{user=await identity();}catch(e){if(!(e instanceof HttpError)||e.status!==401)throw e;}
 if(!user){if(record.is_public!==1&&record.is_demo!==1)throw new HttpError(401,'Este museu exige uma conta para visitar.');return {record,me:null,guest:true};}
 const me=await profile();return {record,me,guest:false};
}
const reply=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
export async function museumResponse(req:Request){
 const {record:p,me,guest}=await resolveMuseum(req),db=database(),owner=p.id,viewer=me?.user.userId||'',own=owner===viewer;
 const [connections,items,comments,counts,social,stats]=await Promise.all([
  db.prepare("SELECT c.provider,c.account,c.last_sync,c.error,c.notice,c.last_import_count,c.cursor,c.simulated,(SELECT COUNT(*) FROM items i WHERE i.owner=c.owner AND i.provider=c.provider) AS imported FROM connections c WHERE c.owner=? AND c.provider IN ('steam','letterboxd','lastfm')").bind(owner).all(),
  db.prepare("SELECT * FROM items WHERE owner=? AND provider IN ('steam','letterboxd','lastfm') ORDER BY pinned DESC,date DESC LIMIT 120").bind(owner).all(),
  guest?Promise.resolve({results:[]}):db.prepare('SELECT c.*,p.name,p.handle FROM comments c JOIN profiles p ON p.id=c.author WHERE c.owner=? ORDER BY c.created DESC LIMIT 100').bind(owner).all(),
  db.prepare("SELECT kind,COUNT(*) AS count FROM items WHERE owner=? AND provider IN ('steam','letterboxd','lastfm') GROUP BY kind").bind(owner).all(),
  db.prepare('SELECT (SELECT COUNT(*) FROM follows WHERE following=?) AS followers,(SELECT COUNT(*) FROM follows WHERE follower=?) AS following,(SELECT COUNT(*) FROM follows WHERE follower=? AND following=?) AS isFollowing').bind(owner,owner,viewer,owner).first(),
  db.prepare("SELECT COALESCE(SUM(CASE WHEN kind='game' THEN CAST(score AS REAL) ELSE 0 END),0) AS minutes,COUNT(CASE WHEN kind='game' AND CAST(score AS REAL)>0 THEN 1 END) AS played FROM items WHERE owner=? AND provider='steam'").bind(owner).first()
 ]);
 return reply({profile:p,viewerProfile:me?.record||null,social,stats,own,guest,viewer,canConfigureServices:me?.user.role==='admin',connections:connections.results,items:items.results,comments:comments.results,counts:counts.results,configured:{steam:!!await serviceKey('steam'),lastfm:!!await serviceKey('lastfm'),letterboxd:true}});
}
export async function libraryRoute(req:Request,path:string){
 const db=database();
 if(req.method==='GET'&&path==='collection'){
  const {record}=await resolveMuseum(req),params=new URL(req.url).searchParams;
  const kind=params.get('kind')||'all',q=(params.get('q')||'').slice(0,100),sort=params.get('sort')||'recent';
  if(!['all','film','music','artist','game','achievement'].includes(kind))throw new HttpError(400,'Categoria inválida.');
  const offset=Number(params.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new HttpError(400,'Página inválida.');
  let where="owner=? AND provider IN ('steam','letterboxd','lastfm')";const args:(string|number)[]=[record.id];
  if(kind==='music')where+=" AND kind IN ('music','artist')";else if(kind!=='all'){where+=' AND kind=?';args.push(kind);}
  if(q){where+=" AND (title LIKE ? ESCAPE '\\' OR subtitle LIKE ? ESCAPE '\\')";const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';args.push(pattern,pattern);}
  const order=sort==='title'?'title COLLATE NOCASE,id':sort==='time'&&kind==='game'?'CAST(score AS REAL) DESC,id':'pinned DESC,date DESC,id';
  const [rows,count]=await Promise.all([db.prepare('SELECT * FROM items WHERE '+where+' ORDER BY '+order+' LIMIT 61 OFFSET ?').bind(...args,offset).all(),db.prepare('SELECT COUNT(*) AS total FROM items WHERE '+where).bind(...args).first<{total:number}>()]);
  return reply({items:rows.results.slice(0,60),total:count?.total||0,nextOffset:rows.results.length>60?offset+60:null});
 }
 const me=await profile();
 if(req.method==='POST'&&path==='imports/letterboxd'){
  const connection=await db.prepare("SELECT account FROM connections WHERE owner=? AND provider='letterboxd'").bind(me.user.userId).first();if(!connection)throw new HttpError(409,'Vincule seu usuário Letterboxd antes de importar o histórico.');
  const body=await jsonBody(req,2200000);let films;try{films=importFilms(value(body.csv,2000000,true));}catch(e){throw new HttpError(400,e instanceof Error?e.message:'CSV inválido.');}
  if(films.length>200)throw new HttpError(400,'Envie até 200 filmes por lote. A interface divide os arquivos automaticamente.');
  await saveEntries(me.user.userId,films);
  await db.prepare("UPDATE connections SET notice=?,error=NULL WHERE owner=? AND provider='letterboxd'").bind('Histórico importado do CSV. O RSS continua buscando novos registros do diário e reviews.',me.user.userId).run();
  return reply({ok:true,count:films.length});
 }
 throw new HttpError(404,'Operação não encontrada.');
}
