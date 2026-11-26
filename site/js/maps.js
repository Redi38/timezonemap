// The map switch in the header: the tabs, the page title, and what is kept when the map changes.  Switching drops what belongs to the
// map being left (hover, search selection, the clock-change layer, the compare panel, the lit-up currency), so each map starts clean.
// style.css shows and hides the controls of each map through body[data-map].  Depends on mode, view, search, changes, compare, money.
import {MAPS,mode,go,onMode} from './mode.js';
import {clearHover} from './view.js';
import {clearSel} from './search.js';
import * as changes from './changes.js';
import * as compare from './compare.js';
import * as money from './money.js';
const nav=document.getElementById('maps'),h1=document.querySelector('h1'),q=document.getElementById('q');
const PLACEHOLDER={time:'Search a city or country',money:'Search a country or currency'};
function apply(){const m=MAPS.find(x=>x.id===mode);
 document.body.dataset.map=mode;document.title=h1.textContent=m.title;
 nav.querySelectorAll('button').forEach(b=>b.toggleAttribute('aria-current',b.dataset.m===mode));
 q.placeholder=PLACEHOLDER[mode];q.setAttribute('aria-label',PLACEHOLDER[mode]);
 if(mode==='money')money.load()}
export function init(){
 nav.innerHTML=MAPS.map(m=>`<button data-m="${m.id}">${m.label}</button>`).join('');
 nav.addEventListener('click',e=>{const b=e.target.closest('button[data-m]');if(b)go(b.dataset.m)});
 onMode(()=>{clearHover();clearSel();changes.off();compare.close();money.pin(null);apply()});
 apply()}
