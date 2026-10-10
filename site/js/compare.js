// Compare cities: pick two cities (same lookup as the search box), see the time difference now, when daylight saving
// next changes that difference, and both cities on the globe joined by a great-circle arc.
import {offOf,fo,clock,zoneName,dayStr,hm,nowDate} from './tz.js';
import {ctx,proj,ctr,path,k,k0} from './view.js';
import {setAuto,flyTo} from './anim.js';
import {findCities,loadCities,onCities} from './search.js';
const btn=document.getElementById('bcmp'),box=document.getElementById('cmp');
const COL=['#ffd34d','#5fd1ff'],DAY=864e5;
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let open=false,pick=[null,null],sug=[[],[]],cur=[-1,-1],inp=[],ul=[],out;
const dayIdx=(c,d)=>Math.floor((d.getTime()+offOf(c.tz,d)*36e5)/DAY);
const ahead=x=>x===0?'the same time':`${hm(Math.abs(x))} ${x>0?'ahead of':'behind'}`;
// First moment within a year when the difference (b minus a, hours) is not what it is now: {t,from,to} or null.
// Daylight saving usually starts and ends on different dates in different countries, so the gap moves twice a year.
const nc={};
function nextChange(a,b,d){const key=a.tz+'|'+b.tz+'|'+Math.floor(d.getTime()/DAY);if(key in nc)return nc[key];
 const diff=t=>offOf(b.tz,new Date(t))-offOf(a.tz,new Date(t)),t0=d.getTime(),d0=diff(t0);let r=null;
 for(let t=t0+2*DAY;t<t0+400*DAY;t+=2*DAY)if(diff(t)!==d0){let lo=t-2*DAY,hi=t;while(hi-lo>6e4){const m=Math.floor((lo+hi)/2);if(diff(m)===d0)lo=m;else hi=m}r={t:hi,from:d0,to:diff(hi)};break}
 return nc[key]=r}
// Everything the panel says about two cities at moment d.
export function info(a,b,d){const oa=offOf(a.tz,d),ob=offOf(b.tz,d);return{oa,ob,diff:ob-oa,days:dayIdx(b,d)-dayIdx(a,d),change:nextChange(a,b,d)}}
function render(){if(!open)return;const d=nowDate(),[a,b]=pick;let h='';
 const row=(c,i,rel)=>{const o=offOf(c.tz,d);return`<div class="r"><i style="background:${COL[i]}"></i><div class="n"><b>${esc(c.n)}</b>, ${esc(c.cn)}<div class="m">${fo(o)} · ${esc(zoneName(c.tz))}</div></div><div class="tm"><span class="t">${clock(c.tz,d,true)}</span><div class="m">${dayStr(c.tz,d)}${rel}</div></div></div>`};
 if(a&&b){const x=info(a,b,d),nm=(c,o)=>esc(c.n===o.n?`${c.n} (${c.cn})`:c.n);
  h=`<div class="head"><b>${nm(b,a)}</b> is ${x.diff===0?'on <b>the same time</b> as':`<b>${ahead(x.diff)}</b>`} <b>${nm(a,b)}</b></div>`+row(a,0,'')+row(b,1,x.days>0?' · next day':x.days<0?' · previous day':'');
  if(a.tz===b.tz)h+=`<div class="note m">Both are in the same time zone.</div>`;
  else if(x.change){const ch=x.change;h+=`<div class="note">On <b>${dayStr(a.tz,new Date(ch.t))}${new Date(ch.t).getFullYear()!==d.getFullYear()?' '+new Date(ch.t).getFullYear():''}</b> in ${esc(a.n)} the difference changes to <b>${ch.to===0?'the same time':hm(Math.abs(ch.to))+(ch.to>0?' ahead':' behind')}</b> (daylight saving).</div>`}
  else h+=`<div class="note m">The difference stays the same for at least the next year.</div>`}
 else if(a||b)h=(a?row(a,0,''):row(b,1,''))+`<div class="note m">Pick a second city to see the difference.</div>`;
 else h='<div class="note m">Type two cities (add the country after a comma to be specific) to see the time difference.</div>';
 if(out.innerHTML!==h)out.innerHTML=h}
function showSug(i){const r=findCities(inp[i].value);sug[i]=r||[];cur[i]=sug[i].length?0:-1;
 if(!inp[i].value.trim()){hideSug(i);return}
 ul[i].innerHTML=r===null?'<li class="m">Loading cities…</li>':r.length?r.map((c,j)=>`<li role="option" data-j="${j}" aria-selected="${j===0}"><span>${esc(c.n)}</span><span class="m">${esc(c.cn)}</span></li>`).join(''):'<li class="m">No match</li>';ul[i].style.display='block'}
function hideSug(i){ul[i].style.display='none';sug[i]=[];cur[i]=-1}
function markSug(i){[...ul[i].children].forEach((li,j)=>li.setAttribute('aria-selected',j===cur[i]))}
// Fly to the pair (or the single city) so that both end up on the visible side of the globe.
function show(){const [a,b]=pick;setAuto(false);
 if(a&&b){const dist=d3.geoDistance(a.ll,b.ll);flyTo(d3.geoInterpolate(a.ll,b.ll)(.5),Math.max(1,Math.min(7,1/Math.sin(Math.min(1.5,dist/1.6)))))}
 else{const c=a||b;if(c)flyTo(c.ll,Math.max(k/k0,3))}}
function choose(i,c){if(!c)return;pick[i]=c;inp[i].value=`${c.n}, ${c.cn}`;hideSug(i);inp[i].blur();show();render()}
function toggle(v){open=v;btn.setAttribute('aria-pressed',v);box.hidden=!v;if(v){loadCities();render();const e=inp.find(x=>!x.value)||inp[0];if(matchMedia('(pointer:fine)').matches)e.focus()}}
export function init(){
 box.innerHTML=`<div class="h"><span>Compare cities</span><button class="x" aria-label="Close" title="Close">×</button></div>`+
  [0,1].map(i=>`<div class="in"><i style="background:${COL[i]}"></i><input data-i="${i}" placeholder="${i?'Second':'First'} city" aria-label="${i?'Second':'First'} city" autocomplete="off" spellcheck="false"><ul class="sug" data-i="${i}" role="listbox"></ul></div>`).join('')+
  `<div class="sw"><button class="swap" aria-label="Swap the two cities" title="Swap the two cities">⇅ Swap</button></div><div class="out" aria-live="polite"></div>`;
 inp=[...box.querySelectorAll('input')];ul=[...box.querySelectorAll('.sug')];out=box.querySelector('.out');
 btn.onclick=()=>toggle(!open);box.querySelector('.x').onclick=()=>toggle(false);
 box.querySelector('.swap').onclick=()=>{pick.reverse();[inp[0].value,inp[1].value]=[inp[1].value,inp[0].value];render()};
 inp.forEach((e,i)=>{e.addEventListener('focus',loadCities);
  e.addEventListener('input',()=>{loadCities();pick[i]=null;showSug(i);render()});
  e.addEventListener('keydown',ev=>{const n=sug[i].length;
   if(ev.key==='ArrowDown'&&n){cur[i]=(cur[i]+1)%n;markSug(i);ev.preventDefault()}
   else if(ev.key==='ArrowUp'&&n){cur[i]=(cur[i]-1+n)%n;markSug(i);ev.preventDefault()}
   else if(ev.key==='Enter'){choose(i,sug[i][cur[i]])}
   else if(ev.key==='Escape'){if(ul[i].style.display==='block')hideSug(i);else toggle(false)}});
  ul[i].addEventListener('pointerdown',ev=>{const li=ev.target.closest('li[data-j]');if(li){ev.preventDefault();choose(i,sug[i][+li.dataset.j])}})});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('#cmp .in'))ul.forEach((_,i)=>hideSug(i))});
 onCities(()=>{inp.forEach((e,i)=>{if(document.activeElement===e&&e.value)showSug(i)})});
 setInterval(render,1000)}
// Overlay (drawn after the map): both cities as coloured pins with their names, joined by a dashed great-circle arc.
export function draw(){if(!open||(!pick[0]&&!pick[1]))return;
 if(pick[0]&&pick[1]){ctx.beginPath();path({type:'LineString',coordinates:[pick[0].ll,pick[1].ll]});ctx.setLineDash([7,6]);ctx.lineWidth=2;ctx.strokeStyle='rgba(255,255,255,.9)';ctx.stroke();ctx.setLineDash([])}
 pick.forEach((c,i)=>{if(!c||d3.geoDistance(ctr,c.ll)>1.5)return;const p=proj(c.ll);if(!p)return;
  ctx.beginPath();ctx.arc(p[0],p[1],6,0,6.2832);ctx.fillStyle=COL[i];ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#13202f';ctx.stroke();
  ctx.font='650 13px system-ui,sans-serif';ctx.lineWidth=3.5;ctx.strokeStyle='rgba(5,10,20,.9)';ctx.fillStyle='#fff';ctx.strokeText(c.n,p[0],p[1]-14);ctx.fillText(c.n,p[0],p[1]-14)})}
