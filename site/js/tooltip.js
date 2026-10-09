// Hover tooltip: builds the per-country (or per-zone) card for the highlighted country and keeps it next to the pointer.
import {now,zoneGroups,gcol} from './zones.js';
import {dstInfo,dayStr,clock,fo,zoneName,zoneListName,changeText} from './tz.js';
import {W,H,hov,hgk,showChg} from './view.js';
const tip=document.getElementById('tip');let tkey='';
function dstHtml(f){const i=dstInfo(f.tz);
 if(i.special)return `<div class="d"><b>Observes daylight saving time</b><br>Morocco keeps ${fo(1)} most of the year and switches back to ${fo(0)} during Ramadan.</div>`;
 if(!i.dst)return `<div class="d m">No daylight saving time · ${fo(f.off)} all year.</div>`;
 const summer=Math.abs(f.off-i.sOff)<1e-6;
 return `<div class="d"><b>Observes daylight saving time</b><br>Summer (DST): ${fo(i.sOff)}${i.sName?' · '+i.sName:''}<br>Winter: ${fo(i.wOff)}${i.wName?' · '+i.wName:''}<div class="m">Currently on ${summer?'daylight saving':'standard'} time · clocks change ${i.next}</div></div>`}
// The clock-change layer's line: what changes this month, with the offsets before and after.
const chgHtml=(chg,cls)=>chg?`<div class="${cls}"><b class="cg">Clocks change this month</b><br>${chg.map(c=>`${changeText(c)} · ${fo(c.from)} → ${fo(c.to)}`).join('<br>')}</div>`:'';
function rowHtml(g,date,on){const i=g.i,t=clock(g.tz,now,true),names=zoneListName(g.zs),
 dst=i.special?`DST: ${fo(1)}, ${fo(0)} during Ramadan`:i.dst?`DST: summer ${fo(i.sOff)} · winter ${fo(i.wOff)} · clocks change ${i.next}`:'No daylight saving time';
 return `<div class="r${on?' on':''}"><i class="sw" style="background:${gcol(g)}"></i><span class="t2">${t}</span> ${fo(g.off)}${date?' · '+date:''}<div class="m">${names}<br>${dst}</div>${showChg?chgHtml(g.chg,'m'):''}</div>`}
// mouse: [x,y] in canvas pixels or null; dragging: the tooltip is hidden while the globe is being dragged
export function tipUpdate(mouse,dragging){if(!hov||!mouse||dragging){tip.style.display='none';tkey='';return}
 let gs;const key=hov.properties.n+'|'+hgk+'|'+now.getSeconds()+'|'+showChg;if(key!==tkey){tkey=key;tip.className='';
  if(!hov.tz)tip.innerHTML=`<b>${hov.properties.n}</b><div class="m">No official local time</div>`;
  else if(hov.z.length>1&&(gs=zoneGroups(hov)).length>1){const ds=gs.map(g=>dayStr(g.tz,now)),same=ds.every(x=>x===ds[0]);
   tip.className=gs.length>5?'big':'';tip.innerHTML=`<b>${hov.properties.n}</b> <span class="m">${gs.length} time zones${same?' · '+ds[0]:''}</span><div class="cols">`+gs.map((g,j)=>rowHtml(g,same?'':ds[j],g.k===hgk)).join('')+'</div>'+(hov.properties.n==='Antarctica'?'<div class="m">No official time: zones follow longitude, and research stations often keep their own.</div>':'')}
  else{const d=dayStr(hov.tz,now),t=clock(hov.tz,now,true);
   tip.innerHTML=`<b>${hov.properties.n}</b><div class="t">${t}</div><div class="m">${d} · ${fo(hov.off)}<br>${zoneName(hov.tz)}</div>${dstHtml(hov)}${showChg?chgHtml(hov.chg,'d'):''}`}}
 tip.style.display='block';const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(4,Math.min(W-w-4,mouse[0]+14))+'px';tip.style.top=Math.max(4,Math.min(H-h-4,mouse[1]+14))+'px'}
