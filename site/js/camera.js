// The canvas, the orthographic projection and the camera (rotation and zoom).  Owns the camera; other modules read it through the
// exports and change it through the functions.  Depends on nothing but d3.
export const cv=document.getElementById('g'),ctx=cv.getContext('2d'),wrap=document.getElementById('wrap');
export const proj=d3.geoOrthographic().precision(.5),path=d3.geoPath(proj,ctx);
export let W,H,k0=0,k=1,ctr=[0,0];   // live bindings: read-only for importers.  k0: the scale that fits the window, k: the current scale, ctr: [lon,lat] under the centre
export const rot=[new Date().getTimezoneOffset()/4,-20];   // [lambda,phi] as d3 wants it; importers must only read it (the hot loop in outlines.js does)
let dpr=1,lastMove=0;
export const getDpr=()=>dpr;
export const moved=()=>performance.now()-lastMove<160;   // the camera was moved by the user a moment ago
export function size(){dpr=window.devicePixelRatio||1;W=wrap.clientWidth;H=wrap.clientHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
 const nk=Math.min(W,H)/2*.94;k=k0?k*nk/k0:nk;k0=nk}
export const getRot=()=>rot.slice();
export function setCamera(lon,lat,scale){rot[0]=lon;rot[1]=lat;k=scale}
export function spin(dlon){rot[0]+=dlon}
export function pan(dx,dy){lastMove=performance.now();rot[0]+=dx*57.3/k;rot[1]=Math.max(-90,Math.min(90,rot[1]-dy*57.3/k))}
export const zoom=m=>{lastMove=performance.now();k=Math.max(k0*.6,Math.min(k0*12,k*m))};
// Applies the camera to the projection at the start of a frame.
export function aim(){proj.translate([W/2,H/2]).scale(k).rotate(rot);ctr=[-rot[0],-rot[1]]}
