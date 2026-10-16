// The sun: where it is overhead (for the day and night shading on the globe) and when it rises and sets at a place.
// Pure maths on instants (ms since 1970, a Date also works) and degrees; no imports, no time zones.  daylight.js adds those.
const R=Math.PI/180,DAY=864e5;
// Where the sun is straight overhead at moment d: [longitude, latitude] in degrees (low-precision solar coordinates, ~0.01 degrees).
export function sunPoint(d){const n=d/864e5+2440587.5-2451545,   // days since J2000
 L=280.46+.9856474*n,g=(357.528+.9856003*n)*R,lam=(L+1.915*Math.sin(g)+.02*Math.sin(2*g))*R,eps=(23.439-4e-7*n)*R,   // mean longitude, mean anomaly, ecliptic longitude, obliquity
 ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam))/R,dec=Math.asin(Math.sin(eps)*Math.sin(lam))/R,gmst=280.46061837+360.98564736629*n;
 return[(((ra-gmst)%360)+540)%360-180,dec]}
const wrap=a=>((a%360)+540)%360-180;
// The instant at which the sun is due south (or north) of longitude lon, the one nearest to t.  The sun is overhead at longitude
// sunPoint()[0], which moves west by 360 degrees a day, so each step moves t by the distance that is left; it settles in a few steps.
export function transit(lon,t){let x=t;for(let i=0;i<4;i++)x+=wrap(sunPoint(x)[0]-lon)/360*DAY;return x}
// The sun counts as risen or set when its upper edge touches the horizon: its centre is then 0.833 degrees below it (the width of
// the disc and the average bending of light by the air).
const H0=-.833;
// Hour angle, in degrees from the transit, at which the sun is at H0 on a day when it is overhead at latitude dec.  0: the sun never
// gets up that far (polar night), 180: it never goes down (polar day).
function hourAngle(lat,dec){const c=(Math.sin(H0*R)-Math.sin(lat*R)*Math.sin(dec*R))/(Math.cos(lat*R)*Math.cos(dec*R));return c>=1?0:c<=-1?180:Math.acos(c)/R}
// The sun's day at latitude lat, longitude lon (degrees, east positive) around the instant t: the day of the transit nearest to t.
//   {state:'normal', noon, rise, set, len}   noon, rise, set are instants (ms), len is the time between them (ms)
//   {state:'day',   noon, len: 24 h}         polar day: the sun stays up
//   {state:'night', noon, len: 0}            polar night: the sun stays down
// Sunrise and sunset are each found with the sun's declination of that moment, which changes by several minutes of arc during a day;
// the result is within about a minute of the almanac values at ordinary latitudes (it is off by more very close to the poles, where
// a small change in declination moves the time a lot).
export function sunDay(lat,lon,t){const la=Math.max(-89.9,Math.min(89.9,lat)),noon=transit(lon,t);
 let wr=hourAngle(la,sunPoint(noon)[1]),ws=wr;
 for(let i=0;i<2;i++){wr=hourAngle(la,sunPoint(noon-wr/360*DAY)[1]);ws=hourAngle(la,sunPoint(noon+ws/360*DAY)[1])}
 if(wr>=180&&ws>=180)return{state:'day',noon,len:DAY};
 if(wr<=0&&ws<=0)return{state:'night',noon,len:0};
 const rise=noon-wr/360*DAY,set=noon+ws/360*DAY;return{state:'normal',noon,rise,set,len:set-rise}}
