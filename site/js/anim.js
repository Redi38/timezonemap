// Animation: the frame loop, auto-rotation and the fly-to-a-place transition. Owns `auto` and `fly`.
import {k,k0,getRot,setCamera,spin,zoomedIn,draw} from './view.js';
let auto=true,fly=null;
export function setAuto(v){auto=v;document.getElementById('brot').textContent=v?'Pause rotation':'Resume rotation'}
export const toggleAuto=()=>setAuto(!auto);
export function cancelFly(){fly=null}
// Turns the globe to centre on ll=[lon,lat] and zooms to z times the base scale.
export function flyTo(ll,z){fly={t0:performance.now(),dur:1100,r0:getRot(),k0:k,r1:[-ll[0],-ll[1]],k1:Math.min(k0*12,k0*z)}}
function stepFly(){if(!fly)return;let u=Math.min(1,(performance.now()-fly.t0)/fly.dur);const e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
 const dl=((fly.r1[0]-fly.r0[0]+540)%360)-180;setCamera(fly.r0[0]+dl*e,fly.r0[1]+(fly.r1[1]-fly.r0[1])*e,fly.k0+(fly.k1-fly.k0)*e);if(u>=1)fly=null}
// isDragging: () => boolean, supplied by the input module so that this one does not depend on it
export function start(isDragging){(function loop(){stepFly();
 if(auto&&zoomedIn())setAuto(false);   // zoomed in to look at the map: stop drifting
 if(auto&&!isDragging())spin(.06);draw(isDragging()||!!fly);requestAnimationFrame(loop)})()}
