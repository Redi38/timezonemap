// Zone data: which zone(s) each country is in, grouping of zones for drawing, colours and the per-country time strings.
// Zone names, offsets, DST and clock formatting are in tz.js.  Depends on tz.js and the DATA and d3 globals.
import {offOf,isKnownZone,nearestZone,zoneRule,clock} from './tz.js';
export const F=DATA.features;
export let now=new Date();
export let zver=0;   // bumped by refresh(): whatever was drawn from the zone data is out of date
// One entry per distinct (current offset, DST rule); zones that behave identically are merged.
export function zoneGroups(f){const m=new Map();
 for(const z of f.z){const {o,i,k}=zoneRule(z,now);
  let g=m.get(k);if(!g){g={k,tz:z,off:o,i,zs:[]};m.set(k,g)}g.zs.push(z)}
 return[...m.values()].sort((a,b)=>a.off-b.off)}
// The same groups plus the map regions (parts) and small-zone markers that belong to each, for drawing.
function mapGroups(f){const gs=zoneGroups(f);
 for(const g of gs){g.parts=f.parts.filter(p=>p.z.some(z=>g.zs.includes(z)));g.marks=f.marks.filter(m=>g.zs.includes(m.z));g.a=g.parts.reduce((t,p)=>t+p.a,0);g.dp=f.dp?f.dp.filter(p=>p.z.some(z=>g.zs.includes(z))):[]}
 return gs.filter(g=>g.parts.length||g.marks.length)}
export const gcol=(g,h)=>`hsl(${(g.off*15+360)%360},55%,${h?70:48}%)`;
export const col=(f,h)=>f.tz?`hsl(${(f.off*15+360)%360},55%,${h?70:48}%)`:'#35425a';
F.forEach(f=>{const g=f.geometry,ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;let best=ps[0],ba=-1;
 ps.forEach(p=>{const a=d3.geoArea({type:'Polygon',coordinates:p});if(a>ba){ba=a;best=p}});
 f.c=d3.geoCentroid({type:'Polygon',coordinates:best});f.a=d3.geoArea(f);
 f.z=(f.properties.z||[]).filter(z=>isKnownZone(z,now));
 if(f.parts){f.marks=f.marks||[];f.parts.forEach(p=>p.geo={type:'MultiPolygon',coordinates:p.g})}
 f.bc=d3.geoCentroid(f);if(!isFinite(f.bc[0]))f.bc=f.c;f.br=0;for(const pl of g.type==='Polygon'?[g.coordinates]:g.coordinates)for(const q of pl[0])f.br=Math.max(f.br,d3.geoDistance(f.bc,q))});
export function refresh(){now=new Date();zver++;F.forEach(f=>{const b=nearestZone(f.z,f.c[0],now);
 f.tz=b;f.off=b?offOf(b,now):null;f.gs=f.parts?mapGroups(f):null});stamp()}
export function stamp(){now=new Date();F.forEach(f=>{f.t=f.tz?clock(f.tz,now):'';if(f.gs)for(const g of f.gs)g.t=clock(g.tz,now)});
 document.getElementById('utc').textContent='UTC '+now.toISOString().slice(11,19)}
