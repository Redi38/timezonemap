// Colours for everything drawn on the canvas, one set per theme.  The page around the globe is styled in style.css; the globe is
// drawn in JS, so it needs its own set.  `pal` is one object whose fields are swapped in place by setLight(), so importers simply
// read pal.x while drawing.  theme.js calls setLight(); onPalette(fn) lets other code (the legend) react to a change.
const DARK={id:'dark',
 ocean0:'#1d4272',ocean1:'#08152b',grat:'rgba(255,255,255,.07)',limb:'rgba(140,190,255,.4)',
 coast:'rgba(6,12,24,.75)',sep:'rgba(6,12,24,.6)',nop:'#35425a',night:'2,6,20',nightMul:null,   // country borders, zone separators, no-official-time fill, night shade (rgb), night shade as multiply colours (null: plain overlay)
 txt:'#fff',txt2:'rgba(235,242,255,.85)',halo:'rgba(5,10,20,.85)',badge:'#ffd34d',   // label text, secondary text, its outline, clock-change badge
 ring:'#fff',hov:'#fff',sel:'#ffd34d',selRgb:'255,211,77',arc:'rgba(255,255,255,.9)',  // dot outline, hovered outline, search selection, compare arc
 dim:'rgba(5,10,22,.55)',chgFill:'rgba(255,196,40,.45)',chgLine:'#ffc233',           // clock-change layer
 s:55,l:48,lh:70};                                                                    // land colour: saturation, lightness, hovered lightness (%)
const LIGHT={id:'light',
 ocean0:'#9ccbf0',ocean1:'#5b9fd9',grat:'rgba(255,255,255,.35)',limb:'rgba(40,85,140,.6)',
 coast:'rgba(20,40,70,.8)',sep:'rgba(20,40,70,.65)',nop:'#a9b5c7',night:'6,16,60',
 nightMul:['rgb(190,200,228)','rgb(222,228,242)','rgb(222,228,242)','rgb(222,228,242)'],   // night on the light map is a multiply (terminator, then civil, nautical, astronomical twilight): it darkens but keeps the zone hues, a plain dark overlay turns them all grey
 txt:'#fff',txt2:'rgba(255,255,255,.92)',halo:'rgba(5,10,20,.85)',badge:'#ffd34d',   // labels as in the dark theme: white with a dark outline stays sharp on the mid-tone land, a light outline smeared the small text
 ring:'rgba(25,45,75,.85)',hov:'#1b3350',sel:'#e08a00',selRgb:'224,138,0',arc:'rgba(25,45,75,.85)',
 dim:'rgba(232,241,251,.65)',chgFill:'rgba(255,170,0,.5)',chgLine:'#d98200',
 s:72,l:58,lh:47};   // clearly coloured land (not pastel), and a darker (not lighter) hover so it still stands out
export const pal={...DARK};
const subs=[];
export const onPalette=f=>{subs.push(f)};
export function setLight(v){const n=v?LIGHT:DARK;if(pal.id===n.id)return;Object.assign(pal,n);subs.forEach(f=>f())}
// The colour of a zone with UTC offset off (hours): one hue per hour round the colour wheel.
export const landColor=(off,hover)=>`hsl(${(off*15+360)%360},${pal.s}%,${hover?pal.lh:pal.l}%)`;
