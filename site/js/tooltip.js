// Hover tooltip: builds the per-country (or per-zone) card for the highlighted country and keeps it next to the pointer.
import {now,h12,dstInfo,dayStr,zoneGroups,gcol,fo} from './zones.js';
import {W,H,hov,hgk} from './view.js';
const tip=document.getElementById('tip');let tkey='';
function dstHtml(f){const i=dstInfo(f.tz);
 if(i.special)return `<div class="d"><b>Observes daylight saving time</b><br>Morocco keeps ${fo(1)} most of the year and switches back to ${fo(0)} during Ramadan.</div>`;
 if(!i.dst)return `<div class="d m">No daylight saving time · ${fo(f.off)} all year.</div>`;
 const summer=Math.abs(f.off-i.sOff)<1e-6;
 return `<div class="d"><b>Observes daylight saving time</b><br>Summer (DST): ${fo(i.sOff)}${i.sName?' · '+i.sName:''}<br>Winter: ${fo(i.wOff)}${i.wName?' · '+i.wName:''}<div class="m">Currently on ${summer?'daylight saving':'standard'} time · clocks change ${i.next}</div></div>`}
function rowHtml(g,date,on){const city=z=>z.split('/').pop().replace(/_/g,' '),i=g.i,
 t=new Intl.DateTimeFormat('en-GB',{timeZone:g.tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:h12}).format(now),
 names=g.zs[0].startsWith('Etc/')&&g.zs.length==1?'Conventional zone':g.zs.slice(0,3).map(city).join(', ')+(g.zs.length>3?' +'+(g.zs.length-3)+' more':''),
 dst=i.special?`DST: ${fo(1)}, ${fo(0)} during Ramadan`:i.dst?`DST: summer ${fo(i.sOff)} · winter ${fo(i.wOff)} · clocks change ${i.next}`:'No daylight saving time';
 return `<div class="r${on?' on':''}"><i class="sw" style="background:${gcol(g)}"></i><span class="t2">${t}</span> ${fo(g.off)}${date?' · '+date:''}<div class="m">${names}<br>${dst}</div></div>`}
// mouse: [x,y] in canvas pixels or null; dragging: the tooltip is hidden while the globe is being dragged
export function tipUpdate(mouse,dragging){if(!hov||!mouse||dragging){tip.style.display='none';tkey='';return}
 let gs;const key=hov.properties.n+'|'+hgk+'|'+now.getSeconds();if(key!==tkey){tkey=key;tip.className='';
  if(!hov.tz)tip.innerHTML=`<b>${hov.properties.n}</b><div class="m">No official local time</div>`;
  else if(hov.z.length>1&&(gs=zoneGroups(hov)).length>1){const ds=gs.map(g=>dayStr(g.tz)),same=ds.every(x=>x===ds[0]);
   tip.className=gs.length>5?'big':'';tip.innerHTML=`<b>${hov.properties.n}</b> <span class="m">${gs.length} time zones${same?' · '+ds[0]:''}</span><div class="cols">`+gs.map((g,j)=>rowHtml(g,same?'':ds[j],g.k===hgk)).join('')+'</div>'+(hov.properties.n==='Antarctica'?'<div class="m">No official time: zones follow longitude, and research stations often keep their own.</div>':'')}
  else{const d=new Intl.DateTimeFormat('en-GB',{timeZone:hov.tz,weekday:'short',day:'numeric',month:'short'}).format(now);
   const t=new Intl.DateTimeFormat('en-GB',{timeZone:hov.tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:h12}).format(now);
   tip.innerHTML=`<b>${hov.properties.n}</b><div class="t">${t}</div><div class="m">${d} · ${fo(hov.off)}<br>${hov.tz.replace(/_/g,' ')}</div>${dstHtml(hov)}`}}
 tip.style.display='block';const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(4,Math.min(W-w-4,mouse[0]+14))+'px';tip.style.top=Math.max(4,Math.min(H-h-4,mouse[1]+14))+'px'}
