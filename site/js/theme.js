// Theme button (sun/moon, top right): switches between the light and the dark theme and remembers the choice in localStorage.
// Until the first click the page follows the system setting.  The choice is the data-theme attribute on <html>, which style.css
// reads; the globe is drawn in JS, so palette.js is told as well.  ../theme-init.js sets the attribute before the first paint.
import {setLight} from './palette.js';
const KEY='theme',root=document.documentElement,btn=document.getElementById('bthm'),mq=matchMedia('(prefers-color-scheme: dark)');
const MOON='<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
 SUN='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const isLight=()=>{const t=root.dataset.theme;return t?t==='light':!mq.matches};
// The icon shows what a click switches to: a moon while the page is light, a sun while it is dark.
function sync(){const l=isLight(),to=l?'dark':'light';setLight(l);btn.innerHTML=l?MOON:SUN;btn.setAttribute('aria-label',`Switch to ${to} theme`);btn.title=`Switch to ${to} theme`}
export function init(){
 try{const s=localStorage.getItem(KEY);if(s==='light'||s==='dark')root.dataset.theme=s}catch(e){}   // storage can be blocked: the button still works, it just forgets
 sync();
 mq.addEventListener('change',sync);   // while no choice is saved this follows the system; after one, isLight() ignores the system
 btn.onclick=()=>{const t=isLight()?'dark':'light';root.dataset.theme=t;sync();try{localStorage.setItem(KEY,t)}catch(e){}}}
