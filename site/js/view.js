// The frame: composes the layers on the canvas and keeps the cache of the base layer.  The rest of the globe lives in
//   camera.js    canvas, projection, rotation and zoom
//   outlines.js  country outlines (coarse and detailed), loading of the detail files
//   hit.js       hit-testing, the highlighted country
//   layers.js    what is drawn: base layer, hover, night, dots, labels
// This module re-exports what other modules use, so they can import everything about the globe from here.
import {pal} from './palette.js';
import {zver} from './zones.js';
import {cv,ctx,proj,path,W,H,k,rot,aim,getDpr} from './camera.js';
import {detOn,getDetailLevel,pathF,prepare,noteCost} from './outlines.js';
import {hov} from './hit.js';
import {showChg,drawNight,drawMarks,drawSpecks,drawLabels,drawBase,paintHover} from './layers.js';
export {cv,ctx,wrap,proj,path,W,H,k0,k,ctr,size,getRot,setCamera,spin,pan,zoom} from './camera.js';
export {zoomedIn,vis,pathF,inF} from './outlines.js';
export {hov,hgk,pick,clearHover} from './hit.js';
export {showChg,setShowChg} from './layers.js';
// Extra layers drawn at the end of every frame, in registration order (the search marker, the tooltip). Kept as hooks so that
// this module does not need to know about them.
const overlays=[];export const addOverlay=fn=>{overlays.push(fn)};
let cKey='',pKey='';const cache=document.createElement('canvas'),cctx=cache.getContext('2d');
// busy: the globe is being dragged or flown right now, so the detailed outlines may be dropped to stay smooth
export function draw(busy){const t0=performance.now(),dpr=getDpr();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);aim();
 const moving=prepare(busy);
 // The base layer (sphere, graticule, every country filled in its zone colours) is by far the most expensive part of a frame and
 // depends only on the camera and the zone data. Once the camera has been still for a frame it is copied into `cache`, and later
 // frames blit that copy; the hovered country is repainted over it, so a hover change never invalidates it. While the globe moves
 // there is nothing to reuse: it is drawn straight to the canvas as before, hover colour included, and no copy is made.
 const key=[W,H,dpr,k,rot[0],rot[1],detOn,getDetailLevel(),zver,showChg,pal.id].join(),still=!moving,inl=moving;let drew=true;
 if(still&&key===cKey){ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(cache,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);drew=false}
 else{drawBase(inl);
  if(still&&key===pKey){if(cache.width!==cv.width||cache.height!==cv.height){cache.width=cv.width;cache.height=cv.height}
   cctx.clearRect(0,0,cache.width,cache.height);cctx.drawImage(cv,0,0);cKey=key}}
 pKey=key;
 if(!inl&&hov)paintHover();
 drawNight();
 if(hov){ctx.beginPath();pathF(hov);ctx.strokeStyle=pal.hov;ctx.lineWidth=1.6;ctx.stroke()}
 ctx.beginPath();ctx.arc(W/2,H/2,k,0,6.2832);ctx.strokeStyle=pal.limb;ctx.lineWidth=1.5;ctx.stroke();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 drawMarks();drawSpecks();drawLabels();
 for(const fn of overlays)fn();if(detOn&&drew)noteCost(performance.now()-t0)}   // blit-only frames say nothing about the cost of drawing
