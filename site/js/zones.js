// Zone data: which zone(s) each country is in, UTC offsets, DST rules, grouping of zones for drawing, colours and time strings.
// Depends on nothing but the DATA and d3 globals, so the view and the tooltip can both build on it.
export const F=DATA.features;
export let now=new Date(),h12=false;
export function setH12(v){h12=v}
const ofc={};
export function offOf(tz,d){const s=(ofc[tz]||(ofc[tz]=new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'longOffset'}))).formatToParts(d).find(p=>p.type==='timeZoneName').value;const m=s.match(/([+-])(\d\d):(\d\d)/);return m?(m[1]==='-'?-1:1)*(+m[2]+ +m[3]/60):0}
const MOROCCO=['Africa/Casablanca','Africa/El_Aaiun'],dstc={};
function zname(tz,t){const n=new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'long'}).formatToParts(t).find(p=>p.type==='timeZoneName').value;return /^GMT/.test(n)?'':n}
// Looks ~13 months ahead for clock changes. A zone observes DST when its offset moves both up and down in that window.
export function dstInfo(tz){const c=dstc[tz];if(c&&Date.now()<c.exp)return c;
 const t0=Date.now(),DAY=864e5,tr=[];let pt=t0,po=offOf(tz,new Date(pt));
 for(let i=1;i<=58;i++){const t=t0+i*7*DAY,o=offOf(tz,new Date(t));
  if(o!==po){let a=pt,b=t;while(b-a>6e4){const m=Math.floor((a+b)/2);if(offOf(tz,new Date(m))===po)a=m;else b=m}tr.push({t:b,from:po,to:o})}
  pt=t;po=o}
 const up=tr.find(x=>x.to>x.from),dn=tr.find(x=>x.to<x.from),exp=Math.min(t0+6*36e5,tr.length?tr[0].t:Infinity);
 if(MOROCCO.includes(tz))return dstc[tz]={dst:true,special:true,exp};
 if(!up||!dn)return dstc[tz]={dst:false,exp};
 const day=new Intl.DateTimeFormat('en-GB',{timeZone:tz,day:'numeric',month:'short'});
 return dstc[tz]={dst:true,exp,sOff:up.to,wOff:dn.to,sName:zname(tz,up.t+DAY),wName:zname(tz,dn.t+DAY),next:day.format(tr[0].t)}}
const dayFmt={};
export function dayStr(tz){return(dayFmt[tz]||(dayFmt[tz]=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'short',day:'numeric',month:'short'}))).format(now)}
// One entry per distinct (current offset, DST rule); zones that behave identically are merged.
export function zoneGroups(f){const m=new Map();
 for(const z of f.z){const o=offOf(z,now),i=dstInfo(z),k=o+'|'+(i.special?'m':i.dst?i.sOff+'/'+i.wOff:'-');
  let g=m.get(k);if(!g){g={k,tz:z,off:o,i,zs:[]};m.set(k,g)}g.zs.push(z)}
 return[...m.values()].sort((a,b)=>a.off-b.off)}
// The same groups plus the map regions (parts) and small-zone markers that belong to each, for drawing.
function mapGroups(f){const gs=zoneGroups(f);
 for(const g of gs){g.parts=f.parts.filter(p=>p.z.some(z=>g.zs.includes(z)));g.marks=f.marks.filter(m=>g.zs.includes(m.z));g.a=g.parts.reduce((t,p)=>t+p.a,0);g.dp=f.dp?f.dp.filter(p=>p.z.some(z=>g.zs.includes(z))):[]}
 return gs.filter(g=>g.parts.length||g.marks.length)}
export const gcol=(g,h)=>`hsl(${(g.off*15+360)%360},55%,${h?70:48}%)`;
export const col=(f,h)=>f.tz?`hsl(${(f.off*15+360)%360},55%,${h?70:48}%)`:'#35425a';
const cache={};
function mk(tz){const key=tz+h12;return cache[key]||(cache[key]=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:h12}))}
export function fo(o){const a=Math.abs(o),h=Math.floor(a),m=Math.round((a-h)*60);return 'UTC'+(o<0?'−':'+')+h+(m?':'+String(m).padStart(2,'0'):'')}
F.forEach(f=>{const g=f.geometry,ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;let best=ps[0],ba=-1;
 ps.forEach(p=>{const a=d3.geoArea({type:'Polygon',coordinates:p});if(a>ba){ba=a;best=p}});
 f.c=d3.geoCentroid({type:'Polygon',coordinates:best});f.a=d3.geoArea(f);
 f.z=(f.properties.z||[]).filter(z=>{try{offOf(z,now);return true}catch(e){return false}});
 if(f.parts){f.marks=f.marks||[];f.parts.forEach(p=>p.geo={type:'MultiPolygon',coordinates:p.g})}
 f.bc=d3.geoCentroid(f);if(!isFinite(f.bc[0]))f.bc=f.c;f.br=0;for(const pl of g.type==='Polygon'?[g.coordinates]:g.coordinates)for(const q of pl[0])f.br=Math.max(f.br,d3.geoDistance(f.bc,q))});
export function refresh(){now=new Date();F.forEach(f=>{let b=null,bd=1e9;for(const z of f.z){const d=Math.abs(offOf(z,now)-f.c[0]/15);if(d<bd){bd=d;b=z}}
 f.tz=b;f.off=b?offOf(b,now):null;f.gs=f.parts?mapGroups(f):null});stamp()}
export function stamp(){now=new Date();F.forEach(f=>{f.t=f.tz?mk(f.tz).format(now):'';if(f.gs)for(const g of f.gs)g.t=mk(g.tz).format(now)});
 document.getElementById('utc').textContent='UTC '+now.toISOString().slice(11,19)}
