// Hit-testing: sets the highlighted country (hov) and, for multi-zone countries, the highlighted zone group (hgk).
// Owns both; other modules read them through the exports.  The dots (m.p, f.sp) are positioned by layers.js each frame.
import {F} from './zones.js';
import {proj,W,H,k} from './camera.js';
import {detOn,inF,hasIn} from './outlines.js';
export let hov=null,hgk=null;   // live bindings: read-only for importers
function pickAt(x,y){if(Math.hypot(x-W/2,y-H/2)>k)return null;const ll=proj.invert([x,y]);return ll?F.find(f=>inF(f,ll))||null:null}
export function pick(x,y){hov=null;hgk=null;
 for(const f of F){if(!f.gs||f.gs.length<2)continue;for(const g of f.gs){
  for(const m of g.marks)if(m.p&&Math.hypot(m.p[0]-x,m.p[1]-y)<10){hov=f;hgk=g.k;return}}}
 for(const f of F)if(f.sp&&Math.hypot(f.sp[0]-x,f.sp[1]-y)<10){hov=f;return}   // a dot of a territory too small to see
 const f=pickAt(x,y);hov=f;if(!f||!f.gs||f.gs.length<2)return;
 const ll=proj.invert([x,y]);if(!ll)return;
 for(const g of f.gs){if(detOn&&g.dp.length?g.dp.some(dp=>dp.items.some(it=>hasIn(it,ll))):g.parts.some(p=>d3.geoContains(p.geo,ll))){hgk=g.k;return}}}
export function clearHover(){hov=null;hgk=null}
