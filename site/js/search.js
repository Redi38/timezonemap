// Search: finds a city (cities.json, fetched on first use) or a country, flies the globe to it and marks it. Owns `sel`.
import {F} from './zones.js';
import {offOf,fo,clock,zoneName} from './tz.js';
import {ctx,proj,ctr,k,k0,vis,pathF,inF} from './view.js';
import {setAuto,flyTo,cancelFly} from './anim.js';
import {DATA} from './data-files.js';
const qEl=document.getElementById('q'),resEl=document.getElementById('res'),foundEl=document.getElementById('found');
const nrm=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ,'-]/g,' ').replace(/\s+/g,' ').trim();
const CALIAS={usa:'United States of America',us:'United States of America','united states':'United States of America',america:'United States of America',uk:'United Kingdom',britain:'United Kingdom',england:'United Kingdom',china:"People's Republic of China",czechia:'Czech Republic',burma:'Myanmar','cote d\'ivoire':'Ivory Coast',holland:'Netherlands',russia:'Russia'};
let cities=null,cityTried=false,cIdx=[],items=[],cur=-1,sel=null;const cbs=[];
const cntIdx=F.map(f=>({kind:'country',n:f.properties.n,f,key:nrm(f.properties.n)}));
export function loadCities(){if(cityTried)return;cityTried=true;fetch(DATA['cities.json']).then(r=>{if(!r.ok)throw 0;return r.json()}).then(d=>{
 cities=d;cIdx=d.c.map(r=>({kind:'city',n:r[0],cc:r[1],cn:d.k[r[1]]||r[1],ll:[r[3],r[2]],tz:r[4],pop:r[5],key:nrm(r[0]),alt:r[6]?nrm(r[6]):'',ckey:nrm(d.k[r[1]]||'')}));
 if(qEl.value)search();cbs.forEach(f=>f())}).catch(()=>{cityTried=false;cities=null})}
// For other panels: run f once the city list has loaded, and look cities up with the search box's rules ('paris, france' works).
// findCities gives null while the list is still loading.
export const onCities=f=>{cbs.push(f)};
export function findCities(text,n=6){if(!cities)return null;let q=nrm(text),cq='';if(q.includes(',')){[q,cq]=q.split(',').map(x=>x.trim())}
 if(!q)return[];const out=[];cityHits(q,cq,out);out.sort((a,b)=>a[0]-b[0]);return out.slice(0,n).map(x=>x[1])}
function cityHits(q,cq,out){for(const c of cIdx){if(cq&&!c.ckey.includes(cq))continue;const sc=Math.min(score(c.key,q),c.alt?score(c.alt,q):9);if(sc<9)out.push([sc*2+1-Math.min(.9,Math.log10(c.pop+1)/8),c]);if(out.length>400)break}}
function score(key,q){return key===q?0:key.startsWith(q)?1:key.includes(' '+q)?2:key.includes(q)?3:9}
function search(){let q=nrm(qEl.value),cq='';if(q.includes(',')){[q,cq]=q.split(',').map(x=>x.trim())}
 if(!q){close();return}
 const out=[],al=CALIAS[q];
 if(!cq)for(const c of cntIdx){const sc=Math.min(score(c.key,q),al&&c.n===al?0:9);if(sc<9)out.push([sc*2+.5,c])}
 cityHits(q,cq,out);
 out.sort((a,b)=>a[0]-b[0]);items=out.slice(0,8).map(x=>x[1]);cur=items.length?0:-1;
 resEl.innerHTML=items.length?items.map((c,i)=>`<li role="option" data-i="${i}" aria-selected="${i===0}"><span>${esc(c.n)}</span><span class="m">${c.kind==='city'?esc(c.cn):'country'}</span></li>`).join(''):
  `<li class="m">${cities||cityTried&&!cities?'No match':'Loading cities…'}</li>`;
 resEl.style.display='block';qEl.setAttribute('aria-expanded','true')}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function close(){resEl.style.display='none';qEl.setAttribute('aria-expanded','false');items=[];cur=-1}
function mark(){[...resEl.children].forEach((li,i)=>li.setAttribute('aria-selected',i===cur))}
function choose(it){if(!it)return;close();qEl.value=it.n;qEl.blur();
 let ll,z;
 if(it.kind==='city'){ll=it.ll;z=Math.max(k/k0,3.5);it.f=F.find(f=>inF(f,ll))||null}
 else{ll=it.f.c;z=Math.max(1,Math.min(7,.62/Math.sin(Math.min(1.3,it.f.br||.3))))}
 sel=it;setAuto(false);flyTo(ll,z);
 foundEl.style.display='block';card()}
function card(){if(!sel)return;const it=sel,t=Date.now();let h;
 const co=(l)=>`${Math.abs(l[1]).toFixed(2)}°${l[1]<0?'S':'N'}, ${Math.abs(l[0]).toFixed(2)}°${l[0]<0?'W':'E'}`;
 if(it.kind==='city'){const d=new Date(t),o=offOf(it.tz,d),tm=clock(it.tz,d,true);
  h=`<b>${esc(it.n)}</b>, ${esc(it.cn)}<div class="m">${co(it.ll)}${it.f&&it.f.properties.n!==it.cn?' · in '+esc(it.f.properties.n):''}</div><div class="t">${tm} <span class="m">${fo(o)}</span></div><div class="m">${esc(zoneName(it.tz))}</div>`}
 else{const f=it.f,gs=f.gs&&f.gs.length>1?f.gs:null;
  h=`<b>${esc(f.properties.n)}</b><div class="m">centre ${co(f.c)}</div>`+(gs?`<div class="m">${gs.length} time zones: ${gs.map(g=>fo(g.off)).join(', ')}</div>`:f.tz?`<div class="t">${f.t} <span class="m">${fo(f.off)}</span></div><div class="m">${esc(zoneName(f.tz))}</div>`:'<div class="m">No official local time</div>')}
 const html=h+'<button aria-label="Clear" title="Clear">×</button>';if(foundEl.dataset.h!==html){foundEl.dataset.h=html;foundEl.innerHTML=html;foundEl.querySelector('button').onclick=clearSel}}
function clearSel(){sel=null;cancelFly();foundEl.style.display='none';foundEl.dataset.h='';qEl.value=''}
// outline of the country the result is in, and a pulsing pin at the exact spot (a view overlay, drawn after the map)
export function drawSel(){if(!sel)return;const f=sel.f;
 if(f&&vis(f.bc,f.br)){ctx.beginPath();pathF(f);ctx.lineWidth=2.4;ctx.strokeStyle='#ffd34d';ctx.stroke()}
 if(sel.kind!=='city'||d3.geoDistance(ctr,sel.ll)>1.5)return;const p=proj(sel.ll);if(!p)return;const ph=(performance.now()%1600)/1600;
 ctx.beginPath();ctx.arc(p[0],p[1],6+ph*18,0,6.2832);ctx.lineWidth=2;ctx.strokeStyle=`rgba(255,211,77,${1-ph})`;ctx.stroke();
 ctx.beginPath();ctx.arc(p[0],p[1],5,0,6.2832);ctx.fillStyle='#ffd34d';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#13202f';ctx.stroke();
 ctx.font='650 13px system-ui,sans-serif';ctx.lineWidth=3.5;ctx.strokeStyle='rgba(5,10,20,.9)';ctx.fillStyle='#fff';ctx.strokeText(sel.n,p[0],p[1]-16);ctx.fillText(sel.n,p[0],p[1]-16)}
export function init(){
 qEl.addEventListener('focus',loadCities);
 qEl.addEventListener('input',()=>{loadCities();search()});
 qEl.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&items.length){cur=(cur+1)%items.length;mark();e.preventDefault()}
  else if(e.key==='ArrowUp'&&items.length){cur=(cur-1+items.length)%items.length;mark();e.preventDefault()}
  else if(e.key==='Enter'){choose(items[cur])}
  else if(e.key==='Escape'){if(resEl.style.display==='block')close();else clearSel()}});
 resEl.addEventListener('pointerdown',e=>{const li=e.target.closest('li[data-i]');if(li){e.preventDefault();choose(items[+li.dataset.i])}});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('#sb'))close()});
 setInterval(card,1000)}
