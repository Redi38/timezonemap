// Projection and drawing: the orthographic globe, camera (rotation and zoom), detailed outlines, hit-testing and the frame renderer.
// Owns the camera and the highlighted country; other modules read them through the exports and change them through the functions.
import {F,col,gcol,refresh,zver} from './zones.js';
import {fo,changeBadge,nowDate} from './tz.js';
import {fetchDetail} from './detail.js';
import {DATA} from './data-files.js';
export const cv=document.getElementById('g'),ctx=cv.getContext('2d'),wrap=document.getElementById('wrap');
export const proj=d3.geoOrthographic().precision(.5),path=d3.geoPath(proj,ctx);
export let W,H,k0=0,k=1,ctr=[0,0],hov=null,hgk=null;   // live bindings: read-only for importers
export let showChg=!1;export const setShowChg=v=>{showChg=v};   // clock-change layer on/off
let dpr=1;const rot=[new Date().getTimezoneOffset()/4,-20];
export function size(){dpr=window.devicePixelRatio||1;W=wrap.clientWidth;H=wrap.clientHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
 const nk=Math.min(W,H)/2*.94;k=k0?k*nk/k0:nk;k0=nk}
// ---- camera
export const getRot=()=>rot.slice();
export function setCamera(lon,lat,scale){rot[0]=lon;rot[1]=lat;k=scale}
export function spin(dlon){rot[0]+=dlon}
export function pan(dx,dy){lastMove=performance.now();rot[0]+=dx*57.3/k;rot[1]=Math.max(-90,Math.min(90,rot[1]-dy*57.3/k))}
export const zoom=m=>{lastMove=performance.now();k=Math.max(k0*.6,Math.min(k0*12,k*m))};
export const zoomedIn=()=>k>k0*DZ_LOAD;
// Where the sun is straight overhead at moment d: [longitude, latitude] in degrees (low-precision solar coordinates, ~0.01 degrees).
export function sunPoint(d){const R=Math.PI/180,n=d/864e5+2440587.5-2451545,   // days since J2000
 L=280.46+.9856474*n,g=(357.528+.9856003*n)*R,lam=(L+1.915*Math.sin(g)+.02*Math.sin(2*g))*R,eps=(23.439-4e-7*n)*R,   // mean longitude, mean anomaly, ecliptic longitude, obliquity
 ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam))/R,dec=Math.asin(Math.sin(eps)*Math.sin(lam))/R,gmst=280.46061837+360.98564736629*n;
 return[(((ra-gmst)%360)+540)%360-180,dec]}
// Day and night: the sun is below the horizon on the shaded side.  Civil, nautical and astronomical twilight (solar zenith angle 96, 102
// and 108 degrees) are three softer steps beyond the terminator (90 degrees); a glow marks the point under the sun.
const NIGHT=[[90,.18],[96,.12],[102,.12],[108,.12]];
function drawNight(){const s=sunPoint(nowDate()),c=[s[0]+180,-s[1]];
 for(const [r,a] of NIGHT){ctx.beginPath();path(d3.geoCircle().center(c).radius(r)());ctx.fillStyle=`rgba(2,6,20,${a})`;ctx.fill()}
 if(d3.geoDistance(ctr,s)>1.5)return;const p=proj(s);if(!p)return;
 const g=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],18);g.addColorStop(0,'rgba(255,236,140,.95)');g.addColorStop(1,'rgba(255,236,140,0)');
 ctx.beginPath();ctx.arc(p[0],p[1],18,0,6.2832);ctx.fillStyle=g;ctx.fill();ctx.beginPath();ctx.arc(p[0],p[1],4,0,6.2832);ctx.fillStyle='#fff6c2';ctx.fill()}
let vr=1.62,det=null,detOn=false,detLevel=-1;const detTried=[];
// Zoomed in, the page swaps the coarse outlines for detail-1.json (Natural Earth 10m simplified, zone regions rebuilt to match),
// and past DZ_FINE for the full detail-2.json.  Each file is fetched once the globe is zoomed past its threshold, so a
// visitor who only zooms in a little never downloads the fine one.  The detail is used past DZ_USE, and only the polygons
// in view are drawn.
const DZ_LOAD=2,DZ_USE=3,DZ_FINE=4,DETAIL=[{url:DATA['detail-1.json'],at:DZ_LOAD},{url:DATA['detail-2.json'],at:DZ_FINE}];
export const vis=(c,r)=>d3.geoDistance(ctr,c)-r<vr;
const capOf=(poly,c)=>({poly,c:[c[0],c[1]],r:c[2]});   // caps come precomputed in the detail files
function applyDetail(d){for(const f of F){const e=d.f[f.properties.n];if(!e)continue;
  f.dg=e.g.map((g,i)=>capOf(g,e.c[i]));for(const it of f.dg)f.br=Math.max(f.br,d3.geoDistance(f.bc,it.c)+it.r);   // islands the coarse outline lacks
  f.dp=(e.p||[]).map(p=>({z:p.z,items:p.g.map((g,i)=>capOf(g,p.c[i]))}))}
 det=d}
// A finer level replaces a coarser one; one that arrives late (a coarser file finishing after a finer one) is ignored.
function loadDetail(i){detTried[i]=true;fetchDetail(DETAIL[i].url).then(d=>{if(i<=detLevel)return;detLevel=i;applyDetail(d);refresh()}).catch(()=>{})}
// A polygon wholly on the near side is projected vertex by vertex, which is several times faster than d3's path pipeline
// (resampling and clipping); only polygons crossing the horizon go through d3. Vertices under half a pixel apart are skipped.
let tgt=ctx,vtol=.8,vmin=.5,moving=false,lastMove=0,dcost=0;const SLOW=30;   // tgt: where polygons are drawn (the canvas, or a Path2D); vtol: vertices closer than this many px are skipped
function itemPath(it){
 if(it.r*k<vmin)return;   // too small to see (while moving the globe, anything under a couple of pixels)
 if(d3.geoDistance(ctr,it.c)+it.r<1.55){   // same maths as proj() for the orthographic projection, without its per-call overhead
  const R=Math.PI/180,L=rot[0]*R,P=rot[1]*R,cP=Math.cos(P),sP=Math.sin(P),sL=Math.sin(L),cL=Math.cos(L),cx=W/2,cy=H/2;
  // per vertex cos/sin of latitude and of longitude are computed once (a[j..j+3]); the rotation then needs no trig at all
  const T=it.T||(it.T=it.poly.map(ring=>{const a=new Float32Array(ring.length*4);ring.forEach((v,i)=>{const la=v[1]*R,lo=v[0]*R;a[i*4]=Math.cos(la);a[i*4+1]=Math.sin(la);a[i*4+2]=Math.sin(lo);a[i*4+3]=Math.cos(lo)});return a}));
  for(const a of T){let px=0,py=0,n=0;
   for(let j=0;j<a.length;j+=4){const cla=a[j],x=cx+k*cla*(a[j+2]*cL+a[j+3]*sL),y=cy-k*(a[j+1]*cP+cla*(a[j+3]*cL-a[j+2]*sL)*sP);
    if(!n){tgt.moveTo(x,y);px=x;py=y;n=1}else if(Math.abs(x-px)+Math.abs(y-py)>vtol){tgt.lineTo(x,y);px=x;py=y}}
   tgt.closePath()}}
 else if(tgt===ctx)path({type:'Polygon',coordinates:it.poly});
 else{path.context(tgt);path({type:'Polygon',coordinates:it.poly});path.context(ctx)}}
// path of a country: the detailed outline (visible polygons only) once zoomed in, else the coarse one
export function pathF(f){if(detOn&&f.dg){for(const it of f.dg)if(vis(it.c,it.r))itemPath(it)}else path(f)}
const hasIn=(it,ll)=>d3.geoDistance(ll,it.c)<=it.r+.002&&d3.geoContains({type:'Polygon',coordinates:it.poly},ll);
export function inF(f,ll){if(d3.geoDistance(ll,f.bc)>f.br+.01)return false;return detOn&&f.dg?f.dg.some(it=>hasIn(it,ll)):d3.geoContains(f,ll)}
// Zone regions reach a little past the country, so they are clipped to its outline. Each group is stroked and then filled over
// its own inner half: that leaves a separator only where two different groups meet and hides seams between zones that behave the same.
// only: a group key to repaint, highlighted, over the cached layer (hover); undefined draws the whole country.
function drawZones(f,only){ctx.save();let P=null;   // zoomed in the outline is built once as a Path2D and reused for the clip and the final stroke
 if(detOn&&f.dg){P=new Path2D();tgt=P;pathF(f);tgt=ctx;ctx.clip(P)}else{ctx.beginPath();pathF(f);ctx.clip()}
 for(const g of f.gs){if(only!==undefined&&g.k!==only)continue;let n=0;ctx.beginPath();
  if(detOn&&g.dp.length){for(const dp of g.dp)for(const it of dp.items)if(vis(it.c,it.r)){itemPath(it);n++}}
  else for(const p of g.parts)if(vis(p.c,p.r)){path(p.geo);n++}
  if(!n)continue;ctx.lineWidth=1.3;ctx.strokeStyle='rgba(6,12,24,.6)';ctx.stroke();ctx.fillStyle=gcol(g,only!==undefined||(inl&&f===hov&&g.k===hgk));ctx.fill();chgTint(!!g.chg)}
 ctx.restore();if(only!==undefined)return;if(P)ctx.stroke(P);else{ctx.beginPath();pathF(f);ctx.stroke()}}
// Zones too small for the country outline (islands, enclaves) get a dot at their real position.
function drawMarks(){for(const f of F){if(!f.gs||f.gs.length<2)continue;
 for(const g of f.gs){
  for(const m of g.marks){m.p=null;if(d3.geoDistance(ctr,m.ll)>1.5)continue;const p=m.p=proj(m.ll);if(!p)continue;const on=f===hov&&g.k===hgk;
   ctx.beginPath();ctx.arc(p[0],p[1],on?6:4.5,0,6.2832);ctx.fillStyle=gcol(g,on);ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle='#fff';ctx.stroke();
   if(on||k>k0*1.7){ctx.font='650 12px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(5,10,20,.85)';ctx.fillStyle='#fff';ctx.strokeText(g.t,p[0],p[1]-12);ctx.fillText(g.t,p[0],p[1]-12);
    if(on||k>k0*3.5){ctx.font='10px system-ui,sans-serif';ctx.lineWidth=2.5;ctx.strokeText(m.n,p[0],p[1]+13);ctx.fillStyle='rgba(235,242,255,.85)';ctx.fillText(m.n,p[0],p[1]+13)}}}}}}
// Clock-change layer: what changes its clocks this month is tinted amber and outlined, everything else is dimmed.
// Called right after a country (or zone group) was filled, while its path is still current.
function chgTint(on){if(!showChg)return;const lw=ctx.lineWidth,ss=ctx.strokeStyle;ctx.fillStyle=on?'rgba(255,196,40,.45)':'rgba(5,10,22,.55)';ctx.fill();
 if(on){ctx.lineWidth=2.2;ctx.strokeStyle='#ffc233';ctx.stroke()}ctx.lineWidth=lw;ctx.strokeStyle=ss}
const badge=o=>showChg&&o.chg?changeBadge(o.chg[0]):'';
function label(c,a,t,n,x){const px=a*k*k;if(px<480||d3.geoDistance(ctr,c)>1.25)return null;const p=proj(c);if(!p)return null;
 const big=px>3600;ctx.font='650 12px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(5,10,20,.85)';ctx.fillStyle='#fff';
 if(t){ctx.strokeText(t,p[0],p[1]);ctx.fillText(t,p[0],p[1])}
 if(big&&n){ctx.font='10px system-ui,sans-serif';ctx.lineWidth=2.5;const y=p[1]+(t?13:0);ctx.strokeText(n,p[0],y);ctx.fillStyle='rgba(235,242,255,.85)';ctx.fillText(n,p[0],y)}
 if(x){ctx.font='650 10.5px system-ui,sans-serif';ctx.lineWidth=2.5;ctx.strokeStyle='rgba(5,10,20,.9)';ctx.fillStyle='#ffd34d';const y=p[1]+13*((t?1:0)+(big&&n?1:0));ctx.strokeText(x,p[0],y);ctx.fillText(x,p[0],y)}
 return p}
// ---- frame
let inl=false,cKey='',pKey='';const cache=document.createElement('canvas'),cctx=cache.getContext('2d');
function drawBase(){
 ctx.beginPath();path({type:'Sphere'});const g=ctx.createRadialGradient(W/2-k*.35,H/2-k*.35,k*.1,W/2,H/2,k);g.addColorStop(0,'#1d4272');g.addColorStop(1,'#08152b');ctx.fillStyle=g;ctx.fill();
 ctx.beginPath();path(d3.geoGraticule10());ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=.6;ctx.stroke();
 ctx.lineWidth=.6;ctx.strokeStyle='rgba(6,12,24,.75)';
 for(const f of F){if(!vis(f.bc,f.br))continue;if(f.gs&&f.gs.length>1){drawZones(f);continue}ctx.beginPath();pathF(f);ctx.fillStyle=col(f,inl&&f===hov);ctx.fill();ctx.stroke();chgTint(!!f.chg)}}
// The hovered country (for a multi-zone one, only the hovered zone group) in its highlight colour, over the base layer.
function paintHover(){const f=hov;ctx.lineWidth=.6;ctx.strokeStyle='rgba(6,12,24,.75)';
 if(f.gs&&f.gs.length>1){if(hgk!==null&&vis(f.bc,f.br))drawZones(f,hgk);return}
 if(!vis(f.bc,f.br))return;ctx.beginPath();pathF(f);ctx.fillStyle=col(f,true);ctx.fill();ctx.stroke();chgTint(!!f.chg)}
// Extra layers drawn at the end of every frame, in registration order (the search marker, the tooltip). Kept as hooks so that
// this module does not need to know about them.
const overlays=[];export const addOverlay=fn=>{overlays.push(fn)};
// busy: the globe is being dragged or flown right now, so the detailed outlines may be dropped to stay smooth
export function draw(busy){const t0=performance.now();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);proj.translate([W/2,H/2]).scale(k).rotate(rot);ctr=[-rot[0],-rot[1]];
 {const hd=Math.hypot(W,H)/2;vr=hd>=k?1.62:Math.min(1.62,Math.asin(hd/k)+.03)}   // angle from the centre to the screen corner
 DETAIL.forEach((L,i)=>{if(!detTried[i]&&k>k0*L.at)loadDetail(i)});moving=busy||performance.now()-lastMove<160;
 // The detailed outlines are kept while moving unless drawing them is slow here (dcost, ms per frame, is measured on detail frames):
 // then the coarse outlines are used until the globe stops, so the motion stays smooth.
 detOn=!!det&&k>k0*DZ_USE&&!(moving&&dcost>SLOW);


 // The base layer (sphere, graticule, every country filled in its zone colours) is by far the most expensive part of a frame and
 // depends only on the camera and the zone data. Once the camera has been still for a frame it is copied into `cache`, and later
 // frames blit that copy; the hovered country is repainted over it, so a hover change never invalidates it. While the globe moves
 // there is nothing to reuse: it is drawn straight to the canvas as before, hover colour included, and no copy is made.
 const key=[W,H,dpr,k,rot[0],rot[1],detOn,detLevel,zver,showChg].join(),still=!moving;inl=moving;let drew=true;
 if(still&&key===cKey){ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(cache,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);drew=false}
 else{drawBase();
  if(still&&key===pKey){if(cache.width!==cv.width||cache.height!==cv.height){cache.width=cv.width;cache.height=cv.height}
   cctx.clearRect(0,0,cache.width,cache.height);cctx.drawImage(cv,0,0);cKey=key}}
 pKey=key;
 if(!inl&&hov)paintHover();
 drawNight();
 if(hov){ctx.beginPath();pathF(hov);ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.stroke()}
 ctx.beginPath();ctx.arc(W/2,H/2,k,0,6.2832);ctx.strokeStyle='rgba(140,190,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 drawMarks();
 for(const f of F){
  if(f.gs&&f.gs.length>1){const lp=[];   // one clock per zone region, with its UTC offset
   for(const g of f.gs){if(!g.parts.length)continue;const p0=g.parts.reduce((a,b)=>b.a>a.a?b:a),p=label(p0.c,p0.a,g.t,fo(g.off),badge(g));if(p)lp.push(p)}
   const q=f.a*k*k>3600&&d3.geoDistance(ctr,f.c)<=1.25&&proj(f.c);   // country name only where it clears the clocks
   if(q&&lp.every(p=>Math.hypot(p[0]-q[0],p[1]-q[1])>48))label(f.c,f.a,'',f.properties.n);continue}
  if(!f.tz){label(f.c,f.a,'',f.properties.n);continue}label(f.c,f.a,f.t,f.properties.n,badge(f))}   // no official time: just the name
 for(const fn of overlays)fn();if(detOn&&drew)dcost=dcost*.8+(performance.now()-t0)*.2}   // blit-only frames say nothing about the cost of drawing
// ---- hit-testing: sets the highlighted country (hov) and, for multi-zone countries, the highlighted zone group (hgk)
function pickAt(x,y){if(Math.hypot(x-W/2,y-H/2)>k)return null;const ll=proj.invert([x,y]);return ll?F.find(f=>inF(f,ll))||null:null}
export function pick(x,y){hov=null;hgk=null;
 for(const f of F){if(!f.gs||f.gs.length<2)continue;for(const g of f.gs){
  for(const m of g.marks)if(m.p&&Math.hypot(m.p[0]-x,m.p[1]-y)<10){hov=f;hgk=g.k;return}}}
 const f=pickAt(x,y);hov=f;if(!f||!f.gs||f.gs.length<2)return;
 const ll=proj.invert([x,y]);if(!ll)return;
 for(const g of f.gs){if(detOn&&g.dp.length?g.dp.some(dp=>dp.items.some(it=>hasIn(it,ll))):g.parts.some(p=>d3.geoContains(p.geo,ll))){hgk=g.k;return}}}
export function clearHover(){hov=null;hgk=null}
