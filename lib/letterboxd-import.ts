import type {Entry} from './catalog';
import {plain} from './catalog';
// RFC 4180-style quoted fields, including commas, CRLF, multiline reviews and doubled quotes.
export function csvRows(text:string){
 if(text.length>2000000)throw Error('Cada CSV pode ter até 2 MB.');
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else field+=c;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;if(rows.length>5000||field.length>100000)throw Error('O arquivo excede o limite de 5.000 registros ou contém um campo muito grande.');}
 if(quoted)throw Error('CSV incompleto: há aspas sem fechamento.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);if(rows.length>5001)throw Error('Importe até 5.000 registros por arquivo.');return rows;
}
export function filmURL(raw:string){try{const u=new URL(raw);if(u.protocol!=='https:'||!['letterboxd.com','www.letterboxd.com'].includes(u.hostname))return '';const match=u.pathname.match(/(?:^|\/)film\/([a-z0-9-]+)(?:\/|$)/i);return match?'https://letterboxd.com/film/'+match[1].toLowerCase()+'/':'';}catch{return '';}}
export function importFilms(text:string):Entry[]{
 const rows=csvRows(text.replace(/^\uFEFF/,''));const header=rows.shift()?.map(x=>x.trim())||[];
 if(!['Name','Year','Letterboxd URI'].every(h=>header.includes(h)))throw Error('Selecione watched.csv, ratings.csv, diary.csv ou reviews.csv da exportação oficial do Letterboxd.');
 const entries=new Map<string,Entry>();
 for(const row of rows){const get=(key:string)=>row[header.indexOf(key)]?.trim()||'';const url=filmURL(get('Letterboxd URI')),title=get('Name');if(!title||!url)throw Error('Uma linha não possui título ou endereço Letterboxd válido.');
  const rating=get('Rating');if(rating&&(!/^\d(?:\.5)?$/.test(rating)||Number(rating)>5))throw Error('Há uma nota inválida no CSV.');
  const dateRaw=get('Watched Date')||get('Date'),date=Date.parse(dateRaw);if(dateRaw&&!Number.isFinite(date))throw Error('Há uma data inválida no CSV.');
  const year=get('Year');if(year&&!/^\d{4}$/.test(year))throw Error('Há um ano inválido no CSV.');
  const item:Entry={id:'csv:'+url,provider:'letterboxd',kind:'film',title:title.slice(0,500),subtitle:year,image:'',url,body:plain(get('Review')).slice(0,12000),date:Number.isFinite(date)?date:0,score:rating,pinned:0};
  const old=entries.get(item.id);if(!old||item.date>=old.date)entries.set(item.id,{...item,body:item.body||old?.body||'',score:item.score||old?.score||''});
 }
 if(!entries.size)throw Error('O CSV não contém filmes para importar.');return [...entries.values()];
}
