// Pointer, wheel and button input. Owns the drag state and the pointer position; turns them into calls on the view and the animation.
import {cv,pick,clearHover,pan,zoom} from './view.js';
import {cancelFly,toggleAuto} from './anim.js';
import {stamp} from './zones.js';
import {h12,setH12} from './tz.js';
let drag=null,mouse=null;
export const isDragging=()=>!!drag;
export const getMouse=()=>mouse;   // [x,y] in canvas pixels, or null when the pointer is off the globe
export function init(){
 cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const r=cv.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top];drag={x:e.clientX,y:e.clientY,m:0};cancelFly()});
 cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top];
  if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.m+=Math.abs(dx)+Math.abs(dy);pan(dx,dy)}
  else pick(mouse[0],mouse[1])});
 cv.addEventListener('pointerup',()=>{if(drag&&drag.m<6)pick(mouse[0],mouse[1]);drag=null});
 cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){mouse=null;clearHover()}});
 cv.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0015));cancelFly()},{passive:false});
 document.getElementById('bzi').onclick=()=>zoom(1.4);document.getElementById('bzo').onclick=()=>zoom(1/1.4);
 document.getElementById('brot').onclick=toggleAuto;
 document.getElementById('bfmt').onclick=e=>{setH12(!h12);e.target.textContent=h12?'Use 24-hour':'Use 12-hour';stamp()}}
