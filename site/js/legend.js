// The colour legend as a control: point at (or tap) an hour of the scale and only the zones with that UTC offset keep their colour,
// the rest are dimmed.  A click keeps the choice (click again or press Escape to clear), moving off the bar returns to it.
import {setFocus} from './view.js';
const MIN=-12,MAX=14;
let pinned=null;
const name=o=>'UTC'+(o<0?'−':'+')+Math.abs(o);
export function init(){const lb=document.getElementById('lb'),lr=document.getElementById('lr');if(!lb||!lr)return;
 const at=e=>{const r=lb.getBoundingClientRect();return Math.max(MIN,Math.min(MAX,Math.round(MIN+(e.clientX-r.left)/r.width*(MAX-MIN))))};
 let off=null;   // when the pointer leaves, the focus is dropped a moment later, so crossing the bar's edge does not flicker
 const show=o=>{clearTimeout(off);setFocus(o);lr.textContent=o===null?'':name(o);lr.classList.toggle('on',o!==null);if(o!==null)lr.style.left=(o-MIN)/(MAX-MIN)*100+'%'};
 lb.addEventListener('pointermove',e=>show(at(e)));
 lb.addEventListener('pointerleave',()=>{clearTimeout(off);off=setTimeout(()=>show(pinned),150)});
 lb.addEventListener('click',e=>{const o=at(e);pinned=pinned===o?null:o;show(pinned)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pinned!==null){pinned=null;show(null)}})}
