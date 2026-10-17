// Country outlines as canvas paths, coarse or detailed, and the loading of the detailed ones.  Depends on camera, zones, detail.
// Zoomed in, the page swaps the coarse outlines for detail-1.json (Natural Earth 10m simplified, zone regions rebuilt to match),
// and past DZ_FINE for the full detail-2.json.  Each file is fetched once the globe is zoomed past its threshold, so a
// visitor who only zooms in a little never downloads the fine one.  The detail is used past DZ_USE, and only the polygons
// in view are drawn.
import {F,refresh} from './zones.js';
import {fetchDetail} from './detail.js';
import {DATA} from './data-files.js';
import {ctx,path,k,k0,ctr,rot,W,H,moved} from './camera.js';
let vr=1.62,det=null,detLevel=-1;const detTried=[];
export let detOn=false;   // live binding: the detailed outlines are in use this frame
const DZ_LOAD=2,DZ_USE=3,DZ_FINE=4,DETAIL=[{url:DATA['detail-1.json'],at:DZ_LOAD},{url:DATA['detail-2.json'],at:DZ_FINE}];
export const zoomedIn=()=>k>k0*DZ_LOAD;
export const getDetailLevel=()=>detLevel;
export const vis=(c,r)=>d3.geoDistance(ctr,c)-r<vr;   // is a cap (centre c, angular radius r) possibly on the screen
const capOf=(poly,c)=>({poly,c:[c[0],c[1]],r:c[2]});   // caps come precomputed in the detail files
function applyDetail(d){for(const f of F){const e=d.f[f.properties.n];if(!e)continue;
  f.dg=e.g.map((g,i)=>capOf(g,e.c[i]));for(const it of f.dg)f.br=Math.max(f.br,d3.geoDistance(f.bc,it.c)+it.r);   // islands the coarse outline lacks
  f.dp=(e.p||[]).map(p=>({z:p.z,items:p.g.map((g,i)=>capOf(g,p.c[i]))}))}
 det=d}
// A finer level replaces a coarser one; one that arrives late (a coarser file finishing after a finer one) is ignored.
function loadDetail(i){detTried[i]=true;fetchDetail(DETAIL[i].url).then(d=>{if(i<=detLevel)return;detLevel=i;applyDetail(d);refresh()}).catch(()=>{})}
// At the start of a frame, after the camera is aimed: the visible angle, the detail files that are due, and whether the detailed outlines
// are used.  They are kept while moving unless drawing them is slow here (dcost, ms per frame, is measured on detail frames; see
// noteCost): then the coarse outlines are used until the globe stops, so the motion stays smooth.  Returns whether the globe is moving.
// busy: the globe is being dragged or flown right now.
let dcost=0;const SLOW=30;
export function prepare(busy){const hd=Math.hypot(W,H)/2;vr=hd>=k?1.62:Math.min(1.62,Math.asin(hd/k)+.03);   // angle from the centre to the screen corner
 DETAIL.forEach((L,i)=>{if(!detTried[i]&&k>k0*L.at)loadDetail(i)});const moving=busy||moved();
 detOn=!!det&&k>k0*DZ_USE&&!(moving&&dcost>SLOW);return moving}
export const noteCost=ms=>{dcost=dcost*.8+ms*.2};
// A polygon wholly on the near side is projected vertex by vertex, which is several times faster than d3's path pipeline
// (resampling and clipping); only polygons crossing the horizon go through d3. Vertices under half a pixel apart are skipped.
let tgt=ctx;const vtol=.8,vmin=.5;   // tgt: where polygons are drawn (the canvas, or a Path2D); vtol: vertices closer than this many px are skipped
export function itemPath(it){
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
// The detailed outline of a country as a Path2D, which can be reused for the clip and the stroke.
export function outline2D(f){const P=new Path2D();tgt=P;pathF(f);tgt=ctx;return P}
export const hasIn=(it,ll)=>d3.geoDistance(ll,it.c)<=it.r+.002&&d3.geoContains({type:'Polygon',coordinates:it.poly},ll);
export function inF(f,ll){if(d3.geoDistance(ll,f.bc)>f.br+.01)return false;return detOn&&f.dg?f.dg.some(it=>hasIn(it,ll)):d3.geoContains(f,ll)}
