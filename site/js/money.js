// The Currencies map.  Loads currencies.json the first time the map is opened and gives every country its currency (f.cur; f.cur2 is a
// second currency that is widely accepted there), builds the texts that describe a currency, and owns the currency legend: the most
// used currencies as chips (point at one to light up its countries, click to keep the choice, click again or press Esc to clear).
// Depends on zones, view, anim, palette, data-files.  The colours come from tools/build_currencies.py (see palette.js).
import {F,refresh} from './zones.js';
import {setCurFocus} from './view.js';
import {setAuto,flyTo} from './anim.js';
import {currencyColor,onPalette} from './palette.js';
import {DATA} from './data-files.js';
const box=document.getElementById('mleg'),TOP=14,SMALL=8;   // chips shown; chips kept on a narrow screen
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// every currency on the map, most countries first: {c: code, n: name, s: symbol, f: family ("Dollar"), i: colour slot, users: [countries, biggest first]}
export let list=null;
let tried=false,failed=false,pinned=null;const cbs=[];
export const onLoad=f=>{cbs.push(f)};   // run f once the currencies have loaded
export function load(){if(tried)return;tried=true;failed=false;fetch(DATA['currencies.json']).then(r=>{if(!r.ok)throw 0;return r.json()}).then(d=>{
 const by=new Map(F.map(f=>[f.properties.n,f])),C={};
 for(const c in d.c){const[n,s,fam,i]=d.c[c];C[c]={c,n,s,f:fam,i,users:[]}}
 for(const n in d.m){const f=by.get(n);if(f){f.cur=C[d.m[n]];f.cur.users.push(f)}}
 for(const n in d.a){const f=by.get(n);if(f)f.cur2=C[d.a[n]]}
 list=Object.values(C).filter(c=>c.users.length);for(const c of list)c.users.sort((a,b)=>b.a-a.a);
 list.sort((a,b)=>b.users.length-a.users.length||a.n.localeCompare(b.n));
 refresh();render();cbs.forEach(f=>f())}).catch(()=>{tried=false;failed=true;render()})}
// The name of the country or territory, then what it uses; the same words in the hover tooltip and the search card.
const names=(us,max)=>us.slice(0,max).map(u=>esc(u.properties.n)).join(', ')+(us.length>max?` +${us.length-max} more`:'');
const places=n=>n===1?'country or territory':'countries and territories';
const code=c=>c.c+(c.s?' · '+esc(c.s):'');
export function infoHtml(f){const n=esc(f.properties.n);
 if(!list)return`<b>${n}</b><div class="m">${failed?'The currencies could not be loaded.':'Loading currencies…'}</div>`;
 const c=f.cur;if(!c)return`<b>${n}</b><div class="m">No official currency</div>`;
 const o=c.users.filter(u=>u!==f);
 return`<b>${n}</b><div class="t">${esc(c.n)}</div><div class="m">${code(c)}</div>`+
  (o.length?`<div class="d">Also used in ${o.length} other ${places(o.length)}:<br>${names(o,8)}</div>`:'')+
  (f.cur2?`<div class="d m">Also widely accepted: ${esc(f.cur2.n)} (${f.cur2.c})</div>`:'')}
export const currencyHtml=c=>`<b>${esc(c.n)}</b><div class="m">${code(c)}</div><div class="d">${c.users.length===1?`Used in ${names(c.users,1)}`:`Used in ${c.users.length} ${places(c.users.length)}:<br>${names(c.users,14)}`}</div>`;
// Zoom that fits a country in the window.
export const fit=f=>Math.max(1,Math.min(7,.62/Math.sin(Math.min(1.3,f.br||.3))));
function render(){
 if(!list){box.innerHTML=`<span class="m">${failed?'The currencies could not be loaded. Switch maps to try again.':'Loading currencies…'}</span>`;return}
 const shown=list.slice(0,TOP),p=pinned&&list.find(c=>c.c===pinned);if(p&&!shown.includes(p))shown.push(p);   // a pinned currency that is not among the biggest still gets its chip
 box.innerHTML=shown.map((c,i)=>`<button class="chip${i>=SMALL&&c!==p?' x':''}" data-c="${c.c}" aria-pressed="${c.c===pinned}" title="${esc(c.n)} · ${c.users.length} ${places(c.users.length)}"><i style="background:${currencyColor(c.i)}"></i>${c.c}<span class="m">${c.users.length}</span></button>`).join('')+
  (list.length>shown.length?`<span class="m more">${list.length-shown.length} more: use the search box</span>`:'')}
// Keep a currency lit up (code, or null to stop); fly: also turn the globe to it (a search result).
export function pin(c,fly){pinned=c;setCurFocus(c);render();
 if(fly&&c){const u=list.find(x=>x.c===c).users;setAuto(false);flyTo(u[0].c,u.length>1?1.6:fit(u[0]))}}
export function init(){
 box.addEventListener('pointerover',e=>{const b=e.target.closest('.chip');if(b&&e.pointerType==='mouse')setCurFocus(b.dataset.c)});
 box.addEventListener('pointerleave',()=>setCurFocus(pinned));   // moving off the chips returns to the kept choice
 box.addEventListener('click',e=>{const b=e.target.closest('.chip');if(b)pin(pinned===b.dataset.c?null:b.dataset.c)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pinned&&document.body.dataset.map==='money'&&document.activeElement!==document.getElementById('q'))pin(null)});
 onPalette(render);render()}
