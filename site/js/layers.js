// What a frame is made of: the base layer (ocean, graticule, countries in their zone colours), the hover repaint, night shading,
// dots for tiny zones and territories, clock-change tint, and the clock labels.  Each function draws straight to the canvas.
// Depends on camera, outlines, hit (for the highlight), zones, palette, sun, tz.  Owns only the clock-change switch.
import {F,col,gcol} from './zones.js';
import {pal} from './palette.js';
import {sunPoint} from './sun.js';
import {fo,changeBadge,nowDate} from './tz.js';
import {ctx,proj,path,W,H,k0,k,ctr} from './camera.js';
import {detOn,vis,pathF,itemPath,outline2D} from './outlines.js';
import {hov,hgk} from './hit.js';
export let showChg=!1;export const setShowChg=v=>{showChg=v};   // clock-change layer on/off; live binding, read-only for importers
// Legend focus: a UTC offset (whole hours) picked in the legend, or null.  Zones with another offset are dimmed, so one offset's zones stand out.
export let focus=null;export const setFocus=v=>{focus=v};
const off0=off=>off!==undefined&&off>=focus-.5&&off<focus+.5;
// Day and night: the sun is below the horizon on the shaded side.  Civil, nautical and astronomical twilight (solar zenith angle 96, 102
// and 108 degrees) are three softer steps beyond the terminator (90 degrees); a glow marks the point under the sun.
const NIGHT=[[90,.18],[96,.12],[102,.12],[108,.12]];
export function drawNight(){const s=sunPoint(nowDate()),c=[s[0]+180,-s[1]];
 NIGHT.forEach(([r,a],i)=>{ctx.beginPath();path(d3.geoCircle().center(c).radius(r)());
  ctx.globalCompositeOperation=pal.nightMul?'multiply':'source-over';ctx.fillStyle=pal.nightMul?pal.nightMul[i]:`rgba(${pal.night},${a})`;ctx.fill()});ctx.globalCompositeOperation='source-over';
 if(d3.geoDistance(ctr,s)>1.5)return;const p=proj(s);if(!p)return;
 const g=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],18);g.addColorStop(0,'rgba(255,236,140,.95)');g.addColorStop(1,'rgba(255,236,140,0)');
 ctx.beginPath();ctx.arc(p[0],p[1],18,0,6.2832);ctx.fillStyle=g;ctx.fill();ctx.beginPath();ctx.arc(p[0],p[1],4,0,6.2832);ctx.fillStyle='#fff6c2';ctx.fill()}
// Zone regions reach a little past the country, so they are clipped to its outline. Each group is stroked and then filled over
// its own inner half: that leaves a separator only where two different groups meet and hides seams between zones that behave the same.
// only: a group key to repaint, highlighted, over the cached layer (hover); undefined draws the whole country.
// inl: the hovered group is highlighted in the base layer itself (while the globe moves there is no cached layer to repaint over).
function drawZones(f,only,inl){ctx.save();let P=null;   // zoomed in the outline is built once as a Path2D and reused for the clip and the final stroke
 if(detOn&&f.dg){P=outline2D(f);ctx.clip(P)}else{ctx.beginPath();pathF(f);ctx.clip()}
 for(const g of f.gs){if(only!==undefined&&g.k!==only)continue;let n=0;ctx.beginPath();
  if(detOn&&g.dp.length){for(const dp of g.dp)for(const it of dp.items)if(vis(it.c,it.r)){itemPath(it);n++}}
  else for(const p of g.parts)if(vis(p.c,p.r)){path(p.geo);n++}
  if(!n)continue;ctx.lineWidth=1.3;ctx.strokeStyle=pal.sep;ctx.stroke();ctx.fillStyle=gcol(g,only!==undefined||(inl&&f===hov&&g.k===hgk));ctx.fill();chgTint(!!g.chg,g.off)}
 ctx.restore();if(only!==undefined)return;if(P)ctx.stroke(P);else{ctx.beginPath();pathF(f);ctx.stroke()}}
// Zones too small for the country outline (islands, enclaves) get a dot at their real position.
export function drawMarks(){for(const f of F){if(!f.gs||f.gs.length<2)continue;
 for(const g of f.gs){
  for(const m of g.marks){m.p=null;if(d3.geoDistance(ctr,m.ll)>1.5)continue;const p=m.p=proj(m.ll);if(!p)continue;const on=f===hov&&g.k===hgk;
   ctx.beginPath();ctx.arc(p[0],p[1],on?6:4.5,0,6.2832);ctx.fillStyle=gcol(g,on);ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle=pal.ring;ctx.stroke();
   if(on||k>k0*1.7){ctx.font='650 12px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle=pal.halo;ctx.fillStyle=pal.txt;ctx.strokeText(g.t,p[0],p[1]-12);ctx.fillText(g.t,p[0],p[1]-12);
    if(on||k>k0*3.5){ctx.font='10px system-ui,sans-serif';ctx.lineWidth=2.5;ctx.strokeText(m.n,p[0],p[1]+13);ctx.fillStyle=pal.txt2;ctx.fillText(m.n,p[0],p[1]+13)}}}}}}
// Territories too small to see (Gibraltar, Monaco, Macau, Nauru, ...) get a dot at their position once zoomed in.  A feature is a speck
// while its outline is under SPECK_PX pixels in radius; the dot goes away by itself when zooming makes the outline big enough to see.
// f.sp is the dot's screen position (null when none), which pick() uses for hit-testing.  Countries with several zones have their own markers.
const SPECK_PX=4;
export function drawSpecks(){const near=k>k0*2.5;
 for(const f of F){f.sp=null;if(!near||(f.gs&&f.gs.length>1)||f.br*k>=SPECK_PX||d3.geoDistance(ctr,f.c)>1.5)continue;
  const p=f.sp=proj(f.c);if(!p)continue;const on=f===hov;
  ctx.beginPath();ctx.arc(p[0],p[1],on?6:4.5,0,6.2832);ctx.fillStyle=col(f,on);ctx.fill();chgTint(!!f.chg,f.tz?f.off:undefined);ctx.lineWidth=1.6;ctx.strokeStyle=pal.ring;ctx.stroke();
  if(on||k>k0*6){ctx.font='650 12px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle=pal.halo;ctx.fillStyle=pal.txt;
   if(f.t){ctx.strokeText(f.t,p[0],p[1]-12);ctx.fillText(f.t,p[0],p[1]-12)}
   ctx.font='10px system-ui,sans-serif';ctx.lineWidth=2.5;ctx.strokeText(f.properties.n,p[0],p[1]+13);ctx.fillStyle=pal.txt2;ctx.fillText(f.properties.n,p[0],p[1]+13)}}}
// Called right after a fill: dims what the legend focus leaves out; then the clock-change layer: what changes its clocks this month is tinted amber and outlined, everything else is dimmed.
// Called right after a country (or zone group) was filled, while its path is still current.
function chgTint(on,off){if(focus!==null&&!off0(off)){ctx.fillStyle=pal.dim;ctx.fill()}if(!showChg)return;const lw=ctx.lineWidth,ss=ctx.strokeStyle;ctx.fillStyle=on?pal.chgFill:pal.dim;ctx.fill();
 if(on){ctx.lineWidth=2.2;ctx.strokeStyle=pal.chgLine;ctx.stroke()}ctx.lineWidth=lw;ctx.strokeStyle=ss}
const badge=o=>showChg&&o.chg?changeBadge(o.chg[0]):'';
function label(c,a,t,n,x){const px=a*k*k;if(px<480||d3.geoDistance(ctr,c)>1.25)return null;const p=proj(c);if(!p)return null;
 const big=px>3600;ctx.font='650 12px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle=pal.halo;ctx.fillStyle=pal.txt;
 if(t){ctx.strokeText(t,p[0],p[1]);ctx.fillText(t,p[0],p[1])}
 if(big&&n){ctx.font='10px system-ui,sans-serif';ctx.lineWidth=2.5;const y=p[1]+(t?13:0);ctx.strokeText(n,p[0],y);ctx.fillStyle=pal.txt2;ctx.fillText(n,p[0],y)}
 if(x){ctx.font='650 10.5px system-ui,sans-serif';ctx.lineWidth=2.5;ctx.strokeStyle=pal.halo;ctx.fillStyle=pal.badge;const y=p[1]+13*((t?1:0)+(big&&n?1:0));ctx.strokeText(x,p[0],y);ctx.fillText(x,p[0],y)}
 return p}
// The clocks (and names) of all countries and zone regions.
export function drawLabels(){for(const f of F){
 if(f.gs&&f.gs.length>1){const lp=[];   // one clock per zone region, with its UTC offset
  for(const g of f.gs){if(!g.parts.length)continue;const p0=g.parts.reduce((a,b)=>b.a>a.a?b:a),p=label(p0.c,p0.a,g.t,fo(g.off),badge(g));if(p)lp.push(p)}
  const q=f.a*k*k>3600&&d3.geoDistance(ctr,f.c)<=1.25&&proj(f.c);   // country name only where it clears the clocks
  if(q&&lp.every(p=>Math.hypot(p[0]-q[0],p[1]-q[1])>48))label(f.c,f.a,'',f.properties.n);continue}
 if(!f.tz){label(f.c,f.a,'',f.properties.n);continue}label(f.c,f.a,f.t,f.properties.n,badge(f))}}   // no official time: just the name
// The base layer (sphere, graticule, every country filled in its zone colours) is by far the most expensive part of a frame.
// inl: the hovered country is highlighted in it (see drawZones).
export function drawBase(inl){
 ctx.beginPath();path({type:'Sphere'});const g=ctx.createRadialGradient(W/2-k*.35,H/2-k*.35,k*.1,W/2,H/2,k);g.addColorStop(0,pal.ocean0);g.addColorStop(1,pal.ocean1);ctx.fillStyle=g;ctx.fill();
 ctx.beginPath();path(d3.geoGraticule10());ctx.strokeStyle=pal.grat;ctx.lineWidth=.6;ctx.stroke();
 ctx.lineWidth=.6;ctx.strokeStyle=pal.coast;
 for(const f of F){if(!vis(f.bc,f.br))continue;if(f.gs&&f.gs.length>1){drawZones(f,undefined,inl);continue}ctx.beginPath();pathF(f);ctx.fillStyle=col(f,inl&&f===hov);ctx.fill();ctx.stroke();chgTint(!!f.chg,f.tz?f.off:undefined)}}
// The hovered country (for a multi-zone one, only the hovered zone group) in its highlight colour, over the base layer.
export function paintHover(){const f=hov;ctx.lineWidth=.6;ctx.strokeStyle=pal.coast;
 if(f.gs&&f.gs.length>1){if(hgk!==null&&vis(f.bc,f.br))drawZones(f,hgk);return}
 if(!vis(f.bc,f.br))return;ctx.beginPath();pathF(f);ctx.fillStyle=col(f,true);ctx.fill();ctx.stroke();chgTint(!!f.chg,f.tz?f.off:undefined)}
