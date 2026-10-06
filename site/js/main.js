// Entry point: wires the modules together and starts the frame loop.
//   zones.js    zone data, offsets, DST, colours            (no local imports)
//   view.js     projection, camera, drawing, hit-testing    (zones)
//   tooltip.js  hover tooltip                               (zones, view)
//   anim.js     frame loop, auto-rotation, fly-to           (view)
//   search.js   city/country search and its map marker      (zones, view, anim)
//   input.js    pointer, wheel and button handlers          (zones, view, anim)
import {refresh,stamp} from './zones.js';
import {size,addOverlay} from './view.js';
import {tipUpdate} from './tooltip.js';
import {start} from './anim.js';
import * as search from './search.js';
import * as input from './input.js';
const lb=document.getElementById('lb'),st=[];for(let o=-12;o<=14;o++)st.push(`hsl(${(o*15+360)%360},55%,48%)`);lb.style.background=`linear-gradient(90deg,${st.join(',')})`;
window.addEventListener('resize',size);size();refresh();setInterval(stamp,1000);setInterval(refresh,60000);
input.init();search.init();
addOverlay(search.drawSel);addOverlay(()=>tipUpdate(input.getMouse(),input.isDragging()));
start(input.isDragging);
