export type TasteProfile = {id:string;name:string;handle:string;bio:string;tags:string;avatar:string;is_demo:number;works?:string[]};
export function tagsOf(raw:string){return [...new Set(raw.split(',').map(x=>x.trim().toLocaleLowerCase('pt-BR')).filter(Boolean))].slice(0,20);}
export function rankPeople(me:TasteProfile,people:TasteProfile[],feedback:{target:string;interest:number}[]){
 const tags=new Set(tagsOf(me.tags));const works=new Set(me.works||[]);
 const preferences=new Map<string,number>();
 for(const vote of feedback){const person=people.find(p=>p.id===vote.target);if(person)for(const tag of tagsOf(person.tags))preferences.set(tag,Math.max(-3,Math.min(3,(preferences.get(tag)||0)+vote.interest)));}
 return people.filter(p=>p.id!==me.id&&!feedback.some(v=>v.target===p.id&&v.interest===-1)).map(p=>{
  const sharedTags=tagsOf(p.tags).filter(t=>tags.has(t));const sharedWorks=[...new Set(p.works||[])].filter(w=>works.has(w));
  const adjustment=tagsOf(p.tags).reduce((n,t)=>n+(preferences.get(t)||0),0);
  return {...p,sharedTags,sharedWorks,score:sharedTags.length*3+sharedWorks.length*5+adjustment,liked:feedback.some(v=>v.target===p.id&&v.interest===1)};
 }).sort((a,b)=>b.score-a.score||a.handle.localeCompare(b.handle));
}
export type ThemeSpec={background:string;foreground:string;accent:string;radius:number};
export function validateTheme(value:unknown):ThemeSpec{
 const t=value as ThemeSpec;if(!t||typeof t!=='object'||![t.background,t.foreground,t.accent].every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))||!Number.isInteger(t.radius)||t.radius<0||t.radius>32)throw Error('Tema inválido. Tente outro pedido.');
 const luminance=(hex:string)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
 const a=luminance(t.background),b=luminance(t.foreground);if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)<4.5)throw Error('O tema gerado tem pouco contraste. Peça outra combinação.');
 return {background:t.background,foreground:t.foreground,accent:t.accent,radius:t.radius};
}
export function themeCSS(spec:ThemeSpec){const t=validateTheme(spec);return `body { background: ${t.background}; color: ${t.foreground}; font-family: system-ui, sans-serif; }\np { color: ${t.foreground}; }\n.profile { border-bottom: 2px solid ${t.accent}; padding-bottom: 24px; margin-bottom: 24px; }\n.item { border: 2px solid ${t.accent}; border-radius: ${t.radius}px; padding: 18px; }\nh1, h2 { color: ${t.foreground}; }`;}
export function parseModelJSON(text:string):unknown{const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');return JSON.parse(clean);}
