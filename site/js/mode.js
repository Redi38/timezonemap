// Which map is showing: 'time' (time zones) or 'money' (currencies).  Owns the choice and keeps it in the URL (#currencies), so each map
// has a link of its own and the browser's back button switches maps.  Other modules read `mode` (a live binding) while they draw and
// register with onMode() to react to a switch.  No imports.
export const MAPS = [
    { id: 'time', hash: '', label: 'Time zones', title: 'World Time Globe' },
    { id: 'money', hash: 'currencies', label: 'Currencies', title: 'World Currency Globe' },
];
const fromHash = () => (MAPS.find(m => m.hash && location.hash === '#' + m.hash) || MAPS[0]).id;
export let mode = fromHash();
const subs = [];
export const onMode = f => {
    subs.push(f);
};
function set(id) {
    if (id === mode) return;
    mode = id;
    subs.forEach(f => f(id));
}
// A click on a tab: switch and add a history entry.
export function go(id) {
    const m = MAPS.find(x => x.id === id);
    if (!m || id === mode) return;
    history.pushState(null, '', m.hash ? '#' + m.hash : location.pathname + location.search);
    set(id);
}
addEventListener('popstate', () => set(fromHash()));
