// Loads the zoomed-in outlines (detail-1.json, detail-2.json) and unpacks them into plain [lon, lat] polygons.
// The files hold integer deltas on a 1/q-degree grid; tools/detail_pack.py describes the format.  No dependencies.
const ring=(a,q)=>{const n=a.length>>1,o=new Array(n+1);let x=0,y=0;
 for(let i=0;i<n;i++){x+=a[2*i];y+=a[2*i+1];o[i]=[x/q,y/q]}
 o[n]=[o[0][0],o[0][1]];return o};   // the closing vertex is not stored
const polys=(ps,q)=>ps.map(p=>p.map(r=>ring(r,q)));
export function unpack(d){if(d.v!==2)throw new Error('unknown detail format');
 const f={};for(const n in d.f){const e=d.f[n],o={g:polys(e.g,d.q),c:e.c};
  if(e.p)o.p=e.p.map(p=>({z:p.z,g:polys(p.g,d.q),c:p.c}));f[n]=o}
 return{f}}
export const fetchDetail=url=>fetch(url).then(r=>{if(!r.ok)throw 0;return r.json()}).then(unpack);
