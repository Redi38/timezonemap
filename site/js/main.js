// Entry point: wires the modules together and starts the frame loop.
//   tz.js       zone names, offsets, DST, clock strings     (no imports)
//   zones.js    zone data per country, grouping, colours    (tz)
//   detail.js   loads and unpacks the zoomed-in outlines    (no imports)
//   view.js     projection, camera, drawing, hit-testing    (zones, tz, detail)
//   tooltip.js  hover tooltip                               (zones, tz, view)
//   anim.js     frame loop, auto-rotation, fly-to           (view)
//   search.js   city/country search and its map marker      (zones, tz, view, anim)
//   changes.js  clock-change layer: button and monthly list (zones, tz, view, anim)
//   compare.js  compare two cities: time difference, arc    (tz, view, anim, search)
//   input.js    pointer, wheel and button handlers          (zones, tz, view, anim)
import {refresh,stamp} from './zones.js';
import {size,addOverlay} from './view.js';
import {tipUpdate} from './tooltip.js';
import {start} from './anim.js';
import * as search from './search.js';
import * as input from './input.js';
import * as changes from './changes.js';
import * as compare from './compare.js';
const lb=document.getElementById('lb'),st=[];for(let o=-12;o<=14;o++)st.push(`hsl(${(o*15+360)%360},55%,48%)`);lb.style.background=`linear-gradient(90deg,${st.join(',')})`;
window.addEventListener('resize',size);size();refresh();setInterval(stamp,1000);setInterval(refresh,60000);
input.init();search.init();changes.init();compare.init();
addOverlay(search.drawSel);addOverlay(compare.draw);addOverlay(()=>tipUpdate(input.getMouse(),input.isDragging()));
start(input.isDragging);
