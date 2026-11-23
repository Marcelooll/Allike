import {plain,safeUrl,type Entry} from './catalog';

// Read only markup returned by the public films page. No challenge solving,
// private endpoints or inferred watched dates.
export function parsePublicFilms(html:string,account:string,page=1){
 if(!/class=["'][^"']*poster-grid/.test(html)&&!/<title>[^<]*films[^<]*Letterboxd/i.test(html))throw Error('A página pública de filmes não pôde ser reconhecida.');
 const grid=html.match(/<section\b[^>]*class=["'][^"']*poster-grid[\s\S]*?<\/section>/i)?.[0]||html.match(/<div\b[^>]*class=["'][^"']*poster-grid[\s\S]*?<\/ul>/i)?.[0]||'';
 const items:Entry[]=[];
 for(const block of grid.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi)||[]){
  const attribute=(name:string)=>plain(block.match(new RegExp(name+'=["\']([^"\']*)["\']','i'))?.[1]||'');
  const slug=attribute('data-item-slug'),display=attribute('data-item-name');
  if(!/^[a-z0-9-]+$/i.test(slug)||!display)continue;
  const year=display.match(/ \((\d{4})\)$/)?.[1]||'';
  const rating=block.match(/\brated-(\d{1,2})\b/)?.[1];
  const candidate=attribute('data-poster-url')||block.match(/<img[^>]+src=["']([^"']+)/i)?.[1]||'';
  items.push({id:'public:'+slug,provider:'letterboxd',kind:'film',title:year?display.slice(0,-7):display,subtitle:year,image:/empty-poster/.test(candidate)?'':safeUrl(candidate),url:'https://letterboxd.com/film/'+slug+'/',body:'',date:0,score:rating&&Number(rating)<=10?String(Number(rating)/2):'',pinned:0,liked:/\b(?:liked-micro|icon-liked)\b/.test(block)?1:0});
 }
 const escaped=account.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const hasNext=new RegExp('href=["\']/'+escaped+'/films/page/'+(page+1)+'/["\']','i').test(html);
 if(!items.length&&!/\b0(?:&nbsp;|\s)+(?:films|films watched)|hasn.t watched any|No films/i.test(html))throw Error('A lista de filmes não pôde ser lida. Os registros anteriores foram preservados.');
 return {items,hasNext};
}
