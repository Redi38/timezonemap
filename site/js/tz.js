// Time zones in one place: names, UTC offsets, daylight-saving detection and clock/date strings.
// Depends on nothing (not even the data), so zones.js, the tooltip and the search box all build on it.
// Zones are IANA names ('Europe/Kyiv').  Antarctica has no official time; its map wedges use the Etc/ names.

// ---- names: the only place that turns a zone id into words (a country -> capital table would plug in here)
export const isConventional=tz=>tz.startsWith('Etc/');
export const zoneCity=tz=>tz.split('/').pop().replace(/_/g,' ');
export const zoneName=tz=>tz.replace(/_/g,' ');
// Up to three cities of zones that behave alike; a lone Etc/ zone is called conventional.
export function zoneListName(zs){return zs.length==1&&isConventional(zs[0])?'Conventional zone':zs.slice(0,3).map(zoneCity).join(', ')+(zs.length>3?' +'+(zs.length-3)+' more':'')}

// ---- clock and date strings; h12 is the 12/24-hour setting
export let h12=false;
export function setH12(v){h12=v}
const fm={};
function fmt(tz,key,o){const id=tz+'|'+key;return fm[id]||(fm[id]=new Intl.DateTimeFormat('en-GB',{timeZone:tz,...o}))}
export const clock=(tz,d,sec)=>fmt(tz,'c'+h12+!!sec,{hour:'2-digit',minute:'2-digit',...(sec?{second:'2-digit'}:null),hour12:h12}).format(d);
export const dayStr=(tz,d)=>fmt(tz,'d',{weekday:'short',day:'numeric',month:'short'}).format(d);
const dateStr=(tz,d)=>fmt(tz,'m',{day:'numeric',month:'short'}).format(d);
export function fo(o){const a=Math.abs(o),h=Math.floor(a),m=Math.round((a-h)*60);return 'UTC'+(o<0?'−':'+')+h+(m?':'+String(m).padStart(2,'0'):'')}

// ---- UTC offsets, in hours
const ofc={};
export function offOf(tz,d){const s=(ofc[tz]||(ofc[tz]=new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'longOffset'}))).formatToParts(d).find(p=>p.type==='timeZoneName').value;const m=s.match(/([+-])(\d\d):(\d\d)/);return m?(m[1]==='-'?-1:1)*(+m[2]+ +m[3]/60):0}
export function isKnownZone(tz,d){try{offOf(tz,d);return true}catch(e){return false}}
// The zone of zs whose offset is closest to the one a longitude would have.
export function nearestZone(zs,lon,d){let b=null,bd=1e9;for(const z of zs){const e=Math.abs(offOf(z,d)-lon/15);if(e<bd){bd=e;b=z}}return b}

// ---- daylight saving
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
 return dstc[tz]={dst:true,exp,sOff:up.to,wOff:dn.to,sName:zname(tz,up.t+DAY),wName:zname(tz,dn.t+DAY),next:dateStr(tz,tr[0].t)}}
// Zones with the same key behave identically right now and from now on: same offset, same DST rule.
export function zoneRule(tz,d){const o=offOf(tz,d),i=dstInfo(tz);return{o,i,k:o+'|'+(i.special?'m':i.dst?i.sOff+'/'+i.wOff:'-')}}
