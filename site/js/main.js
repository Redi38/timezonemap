// Entry point: wires the modules together and starts the frame loop.
//   tz.js       zone names, offsets, DST, clock strings     (no imports)
//   zones.js    zone data per country, grouping, colours    (tz)
//   detail.js   loads and unpacks the zoomed-in outlines    (no imports)
//   camera.js   canvas, projection, rotation and zoom       (no imports)
//   outlines.js country outlines, detail file loading       (camera, zones, detail)
//   hit.js      hit-testing, the highlighted country        (camera, outlines, zones)
//   layers.js   base layer, hover, night, dots, labels      (camera, outlines, hit, zones, tz, sun, palette)
//   view.js     the frame and its cache; re-exports the above (all of them)
//   tooltip.js  hover tooltip                               (zones, tz, view)
//   anim.js     frame loop, auto-rotation, fly-to           (view)
//   search.js   city/country search and its map marker      (zones, tz, view, anim)
//   changes.js  clock-change layer: button and monthly list (zones, tz, view, anim)
//   compare.js  compare two cities: time difference, arc    (tz, view, anim, search)
//   timeslider.js  the time slider: shifts the page's clock  (tz, zones)
//   input.js    pointer, wheel and button handlers          (zones, tz, view, anim)
//   palette.js  canvas colours per theme (light / dark)     (no imports)
//   sun.js      where the sun is overhead, sunrise and sunset (no imports)
//   daylight.js sunrise, sunset, day length in words for a place (tz, sun)
//   theme.js    sun/moon button, saved choice               (palette)
import {refresh,stamp} from './zones.js';
import {size,addOverlay} from './view.js';
import {tipUpdate} from './tooltip.js';
import {start} from './anim.js';
import * as search from './search.js';
import * as input from './input.js';
import * as changes from './changes.js';
import * as compare from './compare.js';
import * as timeslider from './timeslider.js';
import * as theme from './theme.js';
import {landColor,onPalette} from './palette.js';
theme.init();   // first: it sets the globe's palette before anything is drawn
const lb=document.getElementById('lb');
function legend(){const st=[];for(let o=-12;o<=14;o++)st.push(landColor(o));lb.style.background=`linear-gradient(90deg,${st.join(',')})`}
legend();onPalette(legend);
window.addEventListener('resize',size);if(window.ResizeObserver)new ResizeObserver(size).observe(document.getElementById('wrap'));   // any layout change, not only the window
size();refresh();setInterval(stamp,1000);setInterval(refresh,60000);
input.init();search.init();changes.init();compare.init();timeslider.init();
addOverlay(search.drawSel);addOverlay(compare.draw);addOverlay(()=>tipUpdate(input.getMouse(),input.isDragging()));
start(input.isDragging);
