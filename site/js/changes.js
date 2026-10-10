// Clock changes: the "Show clock changes" button, which switches the layer view.js draws, and a list of the changes this
// calendar month, grouped by date.  Countries with several zones are listed by zone when only some of them change.
import {F,now} from './zones.js';
import {dayStr,monthName,zoneListName,hm} from './tz.js';
import {showChg,setShowChg} from './view.js';
import {setAuto,flyTo} from './anim.js';
const btn=document.getElementById('bchg'),box=document.getElementById('cl');
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let shown=[],last='';
// [{t, text, items:[{f, name}]}] in time order: one row per local date and size of the change
function rows(){const m=new Map();
 const add=(f,name,chg)=>{for(const c of chg){const d=c.to-c.from,key=dayStr(c.tz,new Date(c.t))+'|'+d;
  let r=m.get(key);if(!r){r={t:c.t,text:`${dayStr(c.tz,new Date(c.t))} · clocks ${d>0?'forward':'back'} ${hm(Math.abs(d))}`,items:[]};m.set(key,r)}
  r.t=Math.min(r.t,c.t);if(!r.items.some(i=>i.name===name))r.items.push({f,name})}};
 for(const f of F){const gs=f.gs&&f.gs.length>1?f.gs:null,n=f.properties.n;
  if(!f.chg)continue;
  if(!gs||gs.every(g=>g.chg&&g.chg[0].t===gs[0].chg[0].t&&g.chg[0].to-g.chg[0].from===gs[0].chg[0].to-gs[0].chg[0].from))add(f,n,f.chg);
  else for(const g of gs)if(g.chg)add(f,`${n} (${zoneListName(g.zs)})`,g.chg)}
 return[...m.values()].sort((a,b)=>a.t-b.t)}
function render(){if(!showChg){box.hidden=true;return}
 const rs=rows(),n=new Set(rs.flatMap(r=>r.items.map(i=>i.f))).size;shown=[];
 const html=`<div class="h"><span>Clock changes in ${monthName(now)}</span><button aria-label="Close list" title="Close list">×</button></div>`+
  (rs.length?`<div class="m">${n} ${n===1?'country':'countries'} · shaded on the globe</div>`+rs.map(r=>`<div class="row"><b class="cg">${esc(r.text)}</b><div>${r.items.map(i=>`<a tabindex="0" data-i="${shown.push(i.f)-1}">${esc(i.name)}</a>`).join(', ')}</div></div>`).join(''):'<div class="m">No country changes its clocks this month.</div>');
 if(html!==last){last=html;box.innerHTML=html}box.hidden=false}
function go(f){setAuto(false);flyTo(f.c,Math.max(1,Math.min(7,.62/Math.sin(Math.min(1.3,f.br||.3)))))}
function toggle(v){setShowChg(v);btn.setAttribute('aria-pressed',v);btn.textContent=v?'Hide clock changes':'Show clock changes';last='';render()}
export function init(){btn.onclick=()=>toggle(!showChg);
 box.addEventListener('click',e=>{if(e.target.closest('.h button'))return toggle(false);const a=e.target.closest('a[data-i]');if(a)go(shown[+a.dataset.i])});
 box.addEventListener('keydown',e=>{if(e.key==='Enter'){const a=e.target.closest('a[data-i]');if(a)go(shown[+a.dataset.i])}});
 setInterval(()=>{if(showChg)render()},30000)}
