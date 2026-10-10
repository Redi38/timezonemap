// Time slider: moves the page's clock up to a day either way (see nowDate in tz.js), so the zone colours, clocks, panels and
// the day/night shading show another hour.  Dragging only restamps the clocks; the heavier zone refresh (daylight saving, colours)
// runs once the slider has been still for a moment.  Other panels listen for the 'timechange' event.
import {setShift,getShift,nowDate,clock,dayStr} from './tz.js';
import {refresh,stamp} from './zones.js';
const rng=document.getElementById('tsr'),lab=document.getElementById('tsl'),btn=document.getElementById('tsn');
let timer=0;
// The text is as compact as it can be (shift as ±H:MM) and its box has a fixed width in the CSS, so the track never changes size while dragging.
export function label(){const d=nowDate(),m=Math.round(getShift()/6e4),a=Math.abs(m),t=`${dayStr('UTC',d)} ${clock('UTC',d)} UTC · ${m?(m>0?'+':'−')+Math.floor(a/60)+':'+String(a%60).padStart(2,'0'):'live'}`;
 lab.textContent=t;rng.setAttribute('aria-valuetext',t);btn.disabled=!m}
function settle(){timer=0;refresh();label();document.dispatchEvent(new Event('timechange'))}
function apply(min){setShift(min*6e4);stamp();label();clearTimeout(timer);timer=setTimeout(settle,220)}
export function init(){
 rng.addEventListener('input',()=>apply(+rng.value));
 btn.onclick=()=>{rng.value=0;apply(0)};
 setInterval(label,1000)}
