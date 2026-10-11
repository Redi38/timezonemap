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
export const dateStr=(tz,d)=>fmt(tz,'m',{day:'numeric',month:'short'}).format(d);
export function fo(o){const a=Math.abs(o),h=Math.floor(a),m=Math.round((a-h)*60);return 'UTC'+(o<0?'−':'+')+h+(m?':'+String(m).padStart(2,'0'):'')}

// ---- UTC offsets, in hours
const ofc={};
export function offOf(tz,d){const s=(ofc[tz]||(ofc[tz]=new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'longOffset'}))).formatToParts(d).find(p=>p.type==='timeZoneName').value;const m=s.match(/([+-])(\d\d):(\d\d)/);return m?(m[1]==='-'?-1:1)*(+m[2]+ +m[3]/60):0}
export function isKnownZone(tz,d){try{offOf(tz,d);return true}catch(e){return false}}
// The zone of zs whose offset is closest to the one a longitude would have.
export function nearestZone(zs,lon,d){let b=null,bd=1e9;for(const z of zs){const e=Math.abs(offOf(z,d)-lon/15);if(e<bd){bd=e;b=z}}return b}

// ---- daylight saving
const dstc={};
// ---- the page's clock: real time plus the time slider's shift (ms).  Everything that shows "now" reads it from here, so the
// zone colours, clocks, tooltips, panels and the day/night shading all move together.
let shift=0;
export const getShift=()=>shift;
export const nowDate=()=>new Date(Date.now()+shift);
export function setShift(ms){shift=ms;for(const z in dstc)delete dstc[z]}   // the daylight-saving look-ahead starts from the clock
function zname(tz,t){const n=new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'long'}).formatToParts(t).find(p=>p.type==='timeZoneName').value;return /^GMT/.test(n)?'':n}
// First instant in (lo, hi] at which the offset is no longer po (the offset at lo), found by bisection to a minute.
function edge(tz,lo,hi,po){while(hi-lo>6e4){const m=Math.floor((lo+hi)/2);if(offOf(tz,new Date(m))===po)lo=m;else hi=m}return hi}
// Offset changes in [a, b] as [{t, from, to}], sampled weekly (two changes inside one week would cancel out).
function transitions(tz,a,b){const WK=7*864e5,out=[];let pt=a,po=offOf(tz,new Date(pt));
 for(let t=a+WK;;t+=WK){t=Math.min(t,b);const o=offOf(tz,new Date(t));
  if(o!==po)out.push({t:edge(tz,pt,t,po),from:po,to:o});
  pt=t;po=o;if(t>=b)break}
 return out}
// A short pause: the offset drops and comes back to the same value within PAUSE_MAX, the first one that has not ended yet.
// Morocco does this every Ramadan (UTC+1 -> UTC+0 -> UTC+1); ordinary daylight saving lasts months, not weeks.
const PAUSE_MAX=75*864e5;
function pauseOf(tr,t0){for(let i=0;i<tr.length-1;i++){const a=tr[i],b=tr[i+1];
 if(a.to<a.from&&b.to===a.from&&b.t-a.t<PAUSE_MAX&&b.t>t0)return{base:a.from,alt:a.to,t1:a.t,t2:b.t}}return null}
// Is the middle of [a, b] (ms) in Ramadan?  Used only to word the tooltip; false where the browser lacks the Islamic calendar.
function inRamadan(a,b){try{return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{month:'numeric'}).format(new Date((a+b)/2))==='9'}catch(e){return false}}
// Looks ~13 months ahead (and 45 days back, to catch a pause that is under way) for clock changes.
// A zone observes DST when its offset moves both up and down in that window; a short drop that returns (see pauseOf) is reported
// as {special:true, base, alt, ram, next} instead: base is the usual offset, alt the temporary one.
export function dstInfo(tz){const c=dstc[tz],n=nowDate().getTime();if(c&&n<c.exp)return c;
 const t0=n,DAY=864e5,all=transitions(tz,t0-45*DAY,t0+58*7*DAY),tr=all.filter(x=>x.t>t0),exp=Math.min(t0+6*36e5,tr.length?tr[0].t:Infinity);
 const ps=pauseOf(all,t0);
 if(ps)return dstc[tz]={dst:true,special:true,exp,base:ps.base,alt:ps.alt,ram:inRamadan(ps.t1,ps.t2),next:dateStr(tz,ps.t1>t0?ps.t1:ps.t2)};
 const up=tr.find(x=>x.to>x.from),dn=tr.find(x=>x.to<x.from);
 if(!up||!dn)return dstc[tz]={dst:false,exp};
 return dstc[tz]={dst:true,exp,sOff:up.to,wOff:dn.to,sName:zname(tz,up.t+DAY),wName:zname(tz,dn.t+DAY),next:dateStr(tz,tr[0].t)}}
// Zones with the same key behave identically right now and from now on: same offset, same DST rule.
export function zoneRule(tz,d){const o=offOf(tz,d),i=dstInfo(tz);return{o,i,k:o+'|'+(i.special?'p'+i.base+'/'+i.alt:i.dst?i.sOff+'/'+i.wOff:'-')}}

// ---- clock changes within one calendar month (the viewer's local month)
// Any move of the UTC offset counts: daylight saving starting or ending, and permanent changes of standard time.
const mcc={};
export const monthName=d=>new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(d);
// [{t, from, to, tz}] in time order; t is the instant (ms) of the change, from/to the offsets in hours
export function monthChanges(tz,d){const key=tz+'|'+d.getFullYear()+'-'+d.getMonth();if(mcc[key])return mcc[key];
 const a=new Date(d.getFullYear(),d.getMonth(),1).getTime(),b=new Date(d.getFullYear(),d.getMonth()+1,1).getTime(),DAY=864e5,out=[];
 let pt=a,po=offOf(tz,new Date(pt));
 for(let t=a+DAY;;t+=DAY){t=Math.min(t,b-1);const o=offOf(tz,new Date(t));
  if(o!==po)out.push({t:edge(tz,pt,t,po),from:po,to:o,tz});
  pt=t;po=o;if(t>=b-1)break}
 return mcc[key]=out}
export const hm=a=>{const h=Math.floor(a),m=Math.round((a-h)*60);return(h?h+' h':'')+(h&&m?' ':'')+(m?m+' min':'')};
// 'Sun 25 Oct · back 1 h' (local date of the change) and the short form for map labels, '25 Oct −1 h'
export const changeText=c=>`${dayStr(c.tz,new Date(c.t))} · ${c.to>c.from?'forward':'back'} ${hm(Math.abs(c.to-c.from))}`;
export const changeBadge=c=>`${dateStr(c.tz,new Date(c.t))} ${c.to>c.from?'+':'−'}${hm(Math.abs(c.to-c.from))}`;
