const F=DATA.features,cv=document.getElementById('g'),ctx=cv.getContext('2d'),wrap=document.getElementById('wrap'),tip=document.getElementById('tip');
const proj=d3.geoOrthographic().precision(.5),path=d3.geoPath(proj,ctx);
let W,H,k0=0,k=1,dpr=1,rot=[new Date().getTimezoneOffset()/4,-20],h12=false,auto=true,drag=null,hov=null,mouse=null,now=new Date(),tkey='',sel=null;
const ofc={};
function offOf(tz,d){const s=(ofc[tz]||(ofc[tz]=new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'longOffset'}))).formatToParts(d).find(p=>p.type==='timeZoneName').value;const m=s.match(/([+-])(\d\d):(\d\d)/);return m?(m[1]==='-'?-1:1)*(+m[2]+ +m[3]/60):0}
const MOROCCO=['Africa/Casablanca','Africa/El_Aaiun'],dstc={};
function zname(tz,t){const n=new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'long'}).formatToParts(t).find(p=>p.type==='timeZoneName').value;return /^GMT/.test(n)?'':n}
// Looks ~13 months ahead for clock changes. A zone observes DST when its offset moves both up and down in that window.
function dstInfo(tz){const c=dstc[tz];if(c&&Date.now()<c.exp)return c;
 const t0=Date.now(),DAY=864e5,tr=[];let pt=t0,po=offOf(tz,new Date(pt));
 for(let i=1;i<=58;i++){const t=t0+i*7*DAY,o=offOf(tz,new Date(t));
  if(o!==po){let a=pt,b=t;while(b-a>6e4){const m=Math.floor((a+b)/2);if(offOf(tz,new Date(m))===po)a=m;else b=m}tr.push({t:b,from:po,to:o})}
  pt=t;po=o}
 const up=tr.find(x=>x.to>x.from),dn=tr.find(x=>x.to<x.from),exp=Math.min(t0+6*36e5,tr.length?tr[0].t:Infinity);
 if(MOROCCO.includes(tz))return dstc[tz]={dst:true,special:true,exp};
 if(!up||!dn)return dstc[tz]={dst:false,exp};
 const day=new Intl.DateTimeFormat('en-GB',{timeZone:tz,day:'numeric',month:'short'});
 return dstc[tz]={dst:true,exp,sOff:up.to,wOff:dn.to,sName:zname(tz,up.t+DAY),wName:zname(tz,dn.t+DAY),next:day.format(tr[0].t)}}
function dstHtml(f){const i=dstInfo(f.tz);
 if(i.special)return `<div class="d"><b>Observes daylight saving time</b><br>Morocco keeps ${fo(1)} most of the year and switches back to ${fo(0)} during Ramadan.</div>`;
 if(!i.dst)return `<div class="d m">No daylight saving time · ${fo(f.off)} all year.</div>`;
 const summer=Math.abs(f.off-i.sOff)<1e-6;
 return `<div class="d"><b>Observes daylight saving time</b><br>Summer (DST): ${fo(i.sOff)}${i.sName?' · '+i.sName:''}<br>Winter: ${fo(i.wOff)}${i.wName?' · '+i.wName:''}<div class="m">Currently on ${summer?'daylight saving':'standard'} time · clocks change ${i.next}</div></div>`}
const dayFmt={};
function dayStr(tz){return(dayFmt[tz]||(dayFmt[tz]=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'short',day:'numeric',month:'short'}))).format(now)}
// One entry per distinct (current offset, DST rule); zones that behave identically are merged.
function zoneGroups(f){const m=new Map();
 for(const z of f.z){const o=offOf(z,now),i=dstInfo(z),k=o+'|'+(i.special?'m':i.dst?i.sOff+'/'+i.wOff:'-');
  let g=m.get(k);if(!g){g={k,tz:z,off:o,i,zs:[]};m.set(k,g)}g.zs.push(z)}
 return[...m.values()].sort((a,b)=>a.off-b.off)}
// The same groups plus the map regions (parts) and small-zone markers that belong to each, for drawing.
function mapGroups(f){const gs=zoneGroups(f);
 for(const g of gs){g.parts=f.parts.filter(p=>p.z.some(z=>g.zs.includes(z)));g.marks=f.marks.filter(m=>g.zs.includes(m.z));g.a=g.parts.reduce((t,p)=>t+p.a,0);g.dp=f.dp?f.dp.filter(p=>p.z.some(z=>g.zs.includes(z))):[]}
 return gs.filter(g=>g.parts.length||g.marks.length)}
const gcol=(g,h)=>`hsl(${(g.off*15+360)%360},55%,${h?70:48}%)`;
function rowHtml(g,date,on){const city=z=>z.split('/').pop().replace(/_/g,' '),i=g.i,
 t=new Intl.DateTimeFormat('en-GB',{timeZone:g.tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:h12}).format(now),
 names=g.zs[0].startsWith('Etc/')&&g.zs.length==1?'Conventional zone':g.zs.slice(0,3).map(city).join(', ')+(g.zs.length>3?' +'+(g.zs.length-3)+' more':''),
 dst=i.special?`DST: ${fo(1)}, ${fo(0)} during Ramadan`:i.dst?`DST: summer ${fo(i.sOff)} · winter ${fo(i.wOff)} · clocks change ${i.next}`:'No daylight saving time';
 return `<div class="r${on?' on':''}"><i class="sw" style="background:${gcol(g)}"></i><span class="t2">${t}</span> ${fo(g.off)}${date?' · '+date:''}<div class="m">${names}<br>${dst}</div></div>`}
const cache={};
function mk(tz){const key=tz+h12;return cache[key]||(cache[key]=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:h12}))}
function fo(o){const a=Math.abs(o),h=Math.floor(a),m=Math.round((a-h)*60);return 'UTC'+(o<0?'−':'+')+h+(m?':'+String(m).padStart(2,'0'):'')}
F.forEach(f=>{const g=f.geometry,ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;let best=ps[0],ba=-1;
 ps.forEach(p=>{const a=d3.geoArea({type:'Polygon',coordinates:p});if(a>ba){ba=a;best=p}});
 f.c=d3.geoCentroid({type:'Polygon',coordinates:best});f.a=d3.geoArea(f);
 f.z=(f.properties.z||[]).filter(z=>{try{offOf(z,now);return true}catch(e){return false}});
 if(f.parts){f.marks=f.marks||[];f.parts.forEach(p=>p.geo={type:'MultiPolygon',coordinates:p.g})}
 f.bc=d3.geoCentroid(f);if(!isFinite(f.bc[0]))f.bc=f.c;f.br=0;for(const pl of g.type==='Polygon'?[g.coordinates]:g.coordinates)for(const q of pl[0])f.br=Math.max(f.br,d3.geoDistance(f.bc,q))});
function refresh(){now=new Date();F.forEach(f=>{let b=null,bd=1e9;for(const z of f.z){const d=Math.abs(offOf(z,now)-f.c[0]/15);if(d<bd){bd=d;b=z}}
 f.tz=b;f.off=b?offOf(b,now):null;f.gs=f.parts?mapGroups(f):null});stamp()}
function stamp(){now=new Date();F.forEach(f=>{f.t=f.tz?mk(f.tz).format(now):'';if(f.gs)for(const g of f.gs)g.t=mk(g.tz).format(now)});
 document.getElementById('utc').textContent='UTC '+now.toISOString().slice(11,19)}
const col=(f,h)=>f.tz?`hsl(${(f.off*15+360)%360},55%,${h?70:48}%)`:'#35425a';
function sun(){const d=new Date(),doy=(d-Date.UTC(d.getUTCFullYear(),0,0))/864e5,dec=-23.44*Math.cos(2*Math.PI/365*(doy+10)),h=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600;return[(12-h)*15,dec]}
function size(){dpr=window.devicePixelRatio||1;W=wrap.clientWidth;H=wrap.clientHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
 const nk=Math.min(W,H)/2*.94;k=k0?k*nk/k0:nk;k0=nk}
let ctr=[0,0],hgk=null,vr=1.62,det=null,detOn=false,detTried=false;
// Zoomed in, the page swaps the coarse outlines for detail.json (Natural Earth 10m, zone regions rebuilt to match).
// It is fetched once the globe is zoomed past DZ_LOAD and used past DZ_USE, and only the polygons in view are drawn.
const DZ_LOAD=2,DZ_USE=3;
const vis=(c,r)=>d3.geoDistance(ctr,c)-r<vr;
const capOf=(poly,c)=>({poly,c:[c[0],c[1]],r:c[2]});   // caps come precomputed in detail.json
function applyDetail(d){for(const f of F){const e=d.f[f.properties.n];if(!e)continue;
  f.dg=e.g.map((g,i)=>capOf(g,e.c[i]));for(const it of f.dg)f.br=Math.max(f.br,d3.geoDistance(f.bc,it.c)+it.r);   // islands the coarse outline lacks
  f.dp=(e.p||[]).map(p=>({z:p.z,items:p.g.map((g,i)=>capOf(g,p.c[i]))}))}
 det=d}
function loadDetail(){detTried=true;fetch('detail.json').then(r=>{if(!r.ok)throw 0;return r.json()}).then(d=>{applyDetail(d);refresh()}).catch(()=>{})}
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
function pathF(f){if(detOn&&f.dg){for(const it of f.dg)if(vis(it.c,it.r))itemPath(it)}else path(f)}
const hasIn=(it,ll)=>d3.geoDistance(ll,it.c)<=it.r+.002&&d3.geoContains({type:'Polygon',coordinates:it.poly},ll);
function inF(f,ll){if(d3.geoDistance(ll,f.bc)>f.br+.01)return false;return detOn&&f.dg?f.dg.some(it=>hasIn(it,ll)):d3.geoContains(f,ll)}
// Zone regions reach a little past the country, so they are clipped to its outline. Each group is stroked and then filled over
// its own inner half: that leaves a separator only where two different groups meet and hides seams between zones that behave the same.
function drawZones(f){ctx.save();let P=null;   // zoomed in the outline is built once as a Path2D and reused for the clip and the final stroke
 if(detOn&&f.dg){P=new Path2D();tgt=P;pathF(f);tgt=ctx;ctx.clip(P)}else{ctx.beginPath();pathF(f);ctx.clip()}
 for(const g of f.gs){let n=0;ctx.beginPath();
  if(detOn&&g.dp.length){for(const dp of g.dp)for(const it of dp.items)if(vis(it.c,it.r)){itemPath(it);n++}}
  else for(const p of g.parts)if(vis(p.c,p.r)){path(p.geo);n++}
  if(!n)continue;ctx.lineWidth=1.3;ctx.strokeStyle='rgba(6,12,24,.6)';ctx.stroke();ctx.fillStyle=gcol(g,f===hov&&g.k===hgk);ctx.fill()}
 ctx.restore();if(P)ctx.stroke(P);else{ctx.beginPath();pathF(f);ctx.stroke()}}
// Zones too small for the country outline (islands, enclaves) get a dot at their real position.
function drawMarks(){for(const f of F){if(!f.gs||f.gs.length<2)continue;
 for(const g of f.gs){
  for(const m of g.marks){m.p=null;if(d3.geoDistance(ctr,m.ll)>1.5)continue;const p=m.p=proj(m.ll);if(!p)continue;const on=f===hov&&g.k===hgk;
   ctx.beginPath();ctx.arc(p[0],p[1],on?6:4.5,0,6.2832);ctx.fillStyle=gcol(g,on);ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle='#fff';ctx.stroke();
   if(on||k>k0*1.7){ctx.font='650 12px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(5,10,20,.85)';ctx.fillStyle='#fff';ctx.strokeText(g.t,p[0],p[1]-12);ctx.fillText(g.t,p[0],p[1]-12);
    if(on||k>k0*3.5){ctx.font='10px system-ui,sans-serif';ctx.lineWidth=2.5;ctx.strokeText(m.n,p[0],p[1]+13);ctx.fillStyle='rgba(235,242,255,.85)';ctx.fillText(m.n,p[0],p[1]+13)}}}}}}
function label(c,a,t,n){const px=a*k*k;if(px<480||d3.geoDistance(ctr,c)>1.25)return null;const p=proj(c);if(!p)return null;
 const big=px>3600;ctx.font='650 12px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(5,10,20,.85)';ctx.fillStyle='#fff';
 if(t){ctx.strokeText(t,p[0],p[1]);ctx.fillText(t,p[0],p[1])}
 if(big&&n){ctx.font='10px system-ui,sans-serif';ctx.lineWidth=2.5;const y=p[1]+(t?13:0);ctx.strokeText(n,p[0],y);ctx.fillStyle='rgba(235,242,255,.85)';ctx.fillText(n,p[0],y)}
 return p}
function draw(){const t0=performance.now();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);proj.translate([W/2,H/2]).scale(k).rotate(rot);ctr=[-rot[0],-rot[1]];
 {const hd=Math.hypot(W,H)/2;vr=hd>=k?1.62:Math.min(1.62,Math.asin(hd/k)+.03)}   // angle from the centre to the screen corner
 if(!detTried&&k>k0*DZ_LOAD)loadDetail();moving=!!drag||!!fly||performance.now()-lastMove<160;
 // The detailed outlines are kept while moving unless drawing them is slow here (dcost, ms per frame, is measured on detail frames):
 // then the coarse outlines are used until the globe stops, so the motion stays smooth.
 detOn=!!det&&k>k0*DZ_USE&&!(moving&&dcost>SLOW);


 ctx.beginPath();path({type:'Sphere'});const g=ctx.createRadialGradient(W/2-k*.35,H/2-k*.35,k*.1,W/2,H/2,k);g.addColorStop(0,'#1d4272');g.addColorStop(1,'#08152b');ctx.fillStyle=g;ctx.fill();
 ctx.beginPath();path(d3.geoGraticule10());ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=.6;ctx.stroke();
 ctx.lineWidth=.6;ctx.strokeStyle='rgba(6,12,24,.75)';
 for(const f of F){if(!vis(f.bc,f.br))continue;if(f.gs&&f.gs.length>1){drawZones(f);continue}ctx.beginPath();pathF(f);ctx.fillStyle=col(f,f===hov);ctx.fill();ctx.stroke()}
 const s=sun();ctx.beginPath();path(d3.geoCircle().center([s[0]+180,-s[1]]).radius(90)());ctx.fillStyle='rgba(2,6,20,.45)';ctx.fill();
 if(hov){ctx.beginPath();pathF(hov);ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.stroke()}
 ctx.beginPath();ctx.arc(W/2,H/2,k,0,6.2832);ctx.strokeStyle='rgba(140,190,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 drawMarks();
 for(const f of F){
  if(f.gs&&f.gs.length>1){const lp=[];   // one clock per zone region, with its UTC offset
   for(const g of f.gs){if(!g.parts.length)continue;const p0=g.parts.reduce((a,b)=>b.a>a.a?b:a),p=label(p0.c,p0.a,g.t,fo(g.off));if(p)lp.push(p)}
   const q=f.a*k*k>3600&&d3.geoDistance(ctr,f.c)<=1.25&&proj(f.c);   // country name only where it clears the clocks
   if(q&&lp.every(p=>Math.hypot(p[0]-q[0],p[1]-q[1])>48))label(f.c,f.a,'',f.properties.n);continue}
  if(!f.tz){label(f.c,f.a,'',f.properties.n);continue}label(f.c,f.a,f.t,f.properties.n)}   // no official time: just the name
 drawSel();tipUpdate();if(detOn)dcost=dcost*.8+(performance.now()-t0)*.2}
let gs;
function tipUpdate(){if(!hov||!mouse||drag){tip.style.display='none';tkey='';return}
 const key=hov.properties.n+'|'+hgk+'|'+now.getSeconds();if(key!==tkey){tkey=key;tip.className='';
  if(!hov.tz)tip.innerHTML=`<b>${hov.properties.n}</b><div class="m">No official local time</div>`;
  else if(hov.z.length>1&&(gs=zoneGroups(hov)).length>1){const ds=gs.map(g=>dayStr(g.tz)),same=ds.every(x=>x===ds[0]);
   tip.className=gs.length>5?'big':'';tip.innerHTML=`<b>${hov.properties.n}</b> <span class="m">${gs.length} time zones${same?' · '+ds[0]:''}</span><div class="cols">`+gs.map((g,j)=>rowHtml(g,same?'':ds[j],g.k===hgk)).join('')+'</div>'+(hov.properties.n==='Antarctica'?'<div class="m">No official time: zones follow longitude, and research stations often keep their own.</div>':'')}
  else{const d=new Intl.DateTimeFormat('en-GB',{timeZone:hov.tz,weekday:'short',day:'numeric',month:'short'}).format(now);
   const t=new Intl.DateTimeFormat('en-GB',{timeZone:hov.tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:h12}).format(now);
   tip.innerHTML=`<b>${hov.properties.n}</b><div class="t">${t}</div><div class="m">${d} · ${fo(hov.off)}<br>${hov.tz.replace(/_/g,' ')}</div>${dstHtml(hov)}`}}
 tip.style.display='block';const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(4,Math.min(W-w-4,mouse[0]+14))+'px';tip.style.top=Math.max(4,Math.min(H-h-4,mouse[1]+14))+'px'}
function pickAt(x,y){if(Math.hypot(x-W/2,y-H/2)>k)return null;const ll=proj.invert([x,y]);return ll?F.find(f=>inF(f,ll))||null:null}
function pick(x,y){hov=null;hgk=null;
 for(const f of F){if(!f.gs||f.gs.length<2)continue;for(const g of f.gs){
  for(const m of g.marks)if(m.p&&Math.hypot(m.p[0]-x,m.p[1]-y)<10){hov=f;hgk=g.k;return}}}
 const f=pickAt(x,y);hov=f;if(!f||!f.gs||f.gs.length<2)return;
 const ll=proj.invert([x,y]);if(!ll)return;
 for(const g of f.gs){if(detOn&&g.dp.length?g.dp.some(dp=>dp.items.some(it=>hasIn(it,ll))):g.parts.some(p=>d3.geoContains(p.geo,ll))){hgk=g.k;return}}}
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const r=cv.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top];drag={x:e.clientX,y:e.clientY,m:0}});
cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top];
 if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.m+=Math.abs(dx)+Math.abs(dy);lastMove=performance.now();rot[0]+=dx*57.3/k;rot[1]=Math.max(-90,Math.min(90,rot[1]-dy*57.3/k))}
 else pick(mouse[0],mouse[1])});
cv.addEventListener('pointerup',()=>{if(drag&&drag.m<6)pick(mouse[0],mouse[1]);drag=null});
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){mouse=null;hov=null;hgk=null}});
const zoom=m=>{lastMove=performance.now();k=Math.max(k0*.6,Math.min(k0*12,k*m))};
cv.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0015))},{passive:false});
document.getElementById('bzi').onclick=()=>zoom(1.4);document.getElementById('bzo').onclick=()=>zoom(1/1.4);
document.getElementById('brot').onclick=e=>{auto=!auto;e.target.textContent=auto?'Pause rotation':'Resume rotation'};
document.getElementById('bfmt').onclick=e=>{h12=!h12;e.target.textContent=h12?'Use 24-hour':'Use 12-hour';stamp()};
const lb=document.getElementById('lb'),st=[];for(let o=-12;o<=14;o++)st.push(`hsl(${(o*15+360)%360},55%,48%)`);lb.style.background=`linear-gradient(90deg,${st.join(',')})`;
window.addEventListener('resize',size);size();refresh();setInterval(stamp,1000);setInterval(refresh,60000);
// ---- search: finds a city (cities.json, fetched on first use) or a country, flies the globe to it and marks it
const qEl=document.getElementById('q'),resEl=document.getElementById('res'),foundEl=document.getElementById('found');
const nrm=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ,'-]/g,' ').replace(/\s+/g,' ').trim();
const CALIAS={usa:'United States of America',us:'United States of America','united states':'United States of America',america:'United States of America',uk:'United Kingdom',britain:'United Kingdom',england:'United Kingdom',china:"People's Republic of China",czechia:'Czech Republic',burma:'Myanmar','cote d\'ivoire':'Ivory Coast',holland:'Netherlands',russia:'Russia'};
let cities=null,cityTried=false,cIdx=[],fly=null,items=[],cur=-1;
const cntIdx=F.map(f=>({kind:'country',n:f.properties.n,f,key:nrm(f.properties.n)}));
function loadCities(){if(cityTried)return;cityTried=true;fetch('cities.json').then(r=>{if(!r.ok)throw 0;return r.json()}).then(d=>{
 cities=d;cIdx=d.c.map(r=>({kind:'city',n:r[0],cc:r[1],cn:d.k[r[1]]||r[1],ll:[r[3],r[2]],tz:r[4],pop:r[5],key:nrm(r[0]),alt:r[6]?nrm(r[6]):'',ckey:nrm(d.k[r[1]]||'')}));
 if(qEl.value)search()}).catch(()=>{cityTried=false;cities=null})}
function score(key,q){return key===q?0:key.startsWith(q)?1:key.includes(' '+q)?2:key.includes(q)?3:9}
function search(){let q=nrm(qEl.value),cq='';if(q.includes(',')){[q,cq]=q.split(',').map(x=>x.trim())}
 if(!q){close();return}
 const out=[],al=CALIAS[q];
 if(!cq)for(const c of cntIdx){const sc=Math.min(score(c.key,q),al&&c.n===al?0:9);if(sc<9)out.push([sc*2+.5,c])}
 for(const c of cIdx){if(cq&&!c.ckey.includes(cq))continue;const sc=Math.min(score(c.key,q),c.alt?score(c.alt,q):9);if(sc<9)out.push([sc*2+1-Math.min(.9,Math.log10(c.pop+1)/8),c]);if(out.length>400)break}
 out.sort((a,b)=>a[0]-b[0]);items=out.slice(0,8).map(x=>x[1]);cur=items.length?0:-1;
 resEl.innerHTML=items.length?items.map((c,i)=>`<li role="option" data-i="${i}" aria-selected="${i===0}"><span>${esc(c.n)}</span><span class="m">${c.kind==='city'?esc(c.cn):'country'}</span></li>`).join(''):
  `<li class="m">${cities||cityTried&&!cities?'No match':'Loading cities…'}</li>`;
 resEl.style.display='block';qEl.setAttribute('aria-expanded','true')}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function close(){resEl.style.display='none';qEl.setAttribute('aria-expanded','false');items=[];cur=-1}
function mark(){[...resEl.children].forEach((li,i)=>li.setAttribute('aria-selected',i===cur))}
function choose(it){if(!it)return;close();qEl.value=it.n;qEl.blur();
 let ll,z;
 if(it.kind==='city'){ll=it.ll;z=Math.max(k/k0,3.5);it.f=F.find(f=>inF(f,ll))||null}
 else{ll=it.f.c;z=Math.max(1,Math.min(7,.62/Math.sin(Math.min(1.3,it.f.br||.3))))}
 sel=it;auto=false;document.getElementById('brot').textContent='Resume rotation';
 fly={t0:performance.now(),dur:1100,r0:rot.slice(),k0:k,r1:[-ll[0],-ll[1]],k1:Math.min(k0*12,k0*z)};
 foundEl.style.display='block';card()}
function card(){if(!sel)return;const it=sel,t=Date.now();let h;
 const co=(l)=>`${Math.abs(l[1]).toFixed(2)}°${l[1]<0?'S':'N'}, ${Math.abs(l[0]).toFixed(2)}°${l[0]<0?'W':'E'}`;
 if(it.kind==='city'){const d=new Date(t),o=offOf(it.tz,d),tm=new Intl.DateTimeFormat('en-GB',{timeZone:it.tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:h12}).format(d);
  h=`<b>${esc(it.n)}</b>, ${esc(it.cn)}<div class="m">${co(it.ll)}${it.f&&it.f.properties.n!==it.cn?' · in '+esc(it.f.properties.n):''}</div><div class="t">${tm} <span class="m">${fo(o)}</span></div><div class="m">${esc(it.tz.replace(/_/g,' '))}</div>`}
 else{const f=it.f,gs=f.gs&&f.gs.length>1?f.gs:null;
  h=`<b>${esc(f.properties.n)}</b><div class="m">centre ${co(f.c)}</div>`+(gs?`<div class="m">${gs.length} time zones: ${gs.map(g=>fo(g.off)).join(', ')}</div>`:f.tz?`<div class="t">${f.t} <span class="m">${fo(f.off)}</span></div><div class="m">${esc(f.tz.replace(/_/g,' '))}</div>`:'<div class="m">No official local time</div>')}
 const html=h+'<button aria-label="Clear" title="Clear">×</button>';if(foundEl.dataset.h!==html){foundEl.dataset.h=html;foundEl.innerHTML=html;foundEl.querySelector('button').onclick=clearSel}}
function clearSel(){sel=null;fly=null;foundEl.style.display='none';foundEl.dataset.h='';qEl.value=''}
function stepFly(){if(!fly)return;let u=Math.min(1,(performance.now()-fly.t0)/fly.dur);const e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
 const dl=((fly.r1[0]-fly.r0[0]+540)%360)-180;rot[0]=fly.r0[0]+dl*e;rot[1]=fly.r0[1]+(fly.r1[1]-fly.r0[1])*e;k=fly.k0+(fly.k1-fly.k0)*e;if(u>=1)fly=null}
// outline of the country the result is in, and a pulsing pin at the exact spot
function drawSel(){if(!sel)return;const f=sel.f;
 if(f&&vis(f.bc,f.br)){ctx.beginPath();pathF(f);ctx.lineWidth=2.4;ctx.strokeStyle='#ffd34d';ctx.stroke()}
 if(sel.kind!=='city'||d3.geoDistance(ctr,sel.ll)>1.5)return;const p=proj(sel.ll);if(!p)return;const ph=(performance.now()%1600)/1600;
 ctx.beginPath();ctx.arc(p[0],p[1],6+ph*18,0,6.2832);ctx.lineWidth=2;ctx.strokeStyle=`rgba(255,211,77,${1-ph})`;ctx.stroke();
 ctx.beginPath();ctx.arc(p[0],p[1],5,0,6.2832);ctx.fillStyle='#ffd34d';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#13202f';ctx.stroke();
 ctx.font='650 13px system-ui,sans-serif';ctx.lineWidth=3.5;ctx.strokeStyle='rgba(5,10,20,.9)';ctx.fillStyle='#fff';ctx.strokeText(sel.n,p[0],p[1]-16);ctx.fillText(sel.n,p[0],p[1]-16)}
qEl.addEventListener('focus',loadCities);
qEl.addEventListener('input',()=>{loadCities();search()});
qEl.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&items.length){cur=(cur+1)%items.length;mark();e.preventDefault()}
 else if(e.key==='ArrowUp'&&items.length){cur=(cur-1+items.length)%items.length;mark();e.preventDefault()}
 else if(e.key==='Enter'){choose(items[cur])}
 else if(e.key==='Escape'){if(resEl.style.display==='block')close();else clearSel()}});
resEl.addEventListener('pointerdown',e=>{const li=e.target.closest('li[data-i]');if(li){e.preventDefault();choose(items[+li.dataset.i])}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#sb'))close()});
cv.addEventListener('pointerdown',()=>{fly=null});cv.addEventListener('wheel',()=>{fly=null},{passive:true});
setInterval(card,1000);
(function loop(){stepFly();
 if(auto&&k>k0*DZ_LOAD){auto=false;document.getElementById('brot').textContent='Resume rotation'}   // zoomed in to look at the map: stop drifting
 if(auto&&!drag)rot[0]+=.06;draw();requestAnimationFrame(loop)})();
