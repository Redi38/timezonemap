// Runs in <head>, before the page is painted: applies a saved light/dark choice so the page does not flash the other theme.
// The button and the rest of the logic are in js/theme.js; "auto" (or nothing saved) leaves the attribute off and the CSS follows the system.
try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}
