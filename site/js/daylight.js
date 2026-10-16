// Sunrise, sunset and the length of daylight at a place, as words for the panels.  sun.js has the astronomy; this adds the place's
// time zone (which calendar day it is there, and the clock times in it) and the wording.  Depends on tz.js and sun.js.
import {sunDay} from './sun.js';
import {offOf,clock} from './tz.js';
const DAY=864e5,H=36e5;
// Length of time as '10 h 51 min', '12 h', '45 min'.
const dur=ms=>{const m=Math.round(ms/6e4),h=Math.floor(m/60);return h?`${h} h`+(m%60?` ${m%60} min`:''):`${m} min`};
// A change in seconds as '2 min 13 s' or '41 s'; anything over an hour is given as a plain length of time.
const secs=s=>s<60?`${s} s`:s<3600?`${Math.floor(s/60)} min`+(s%60?` ${s%60} s`:''):dur(s*1000);
// The sun at place ll=[lon,lat], whose clocks follow zone tz, on the calendar day there that moment d falls in, together with
// the day before it, so that the panels can say how much longer or shorter the day has become.
export function daylight(ll,tz,d){const t=d.getTime(),o=offOf(tz,d),loc=Math.floor((t+o*H)/DAY),   // loc: the local date as a day number
 noon=loc*DAY+12*H-offOf(tz,new Date(loc*DAY+12*H-o*H))*H;   // local midday, as an instant
 return{today:sunDay(ll[1],ll[0],noon),yest:sunDay(ll[1],ll[0],noon-DAY),tz}}
// Which local day an instant is on, as a day number.
const dayNo=(tz,ms)=>Math.floor((ms+offOf(tz,new Date(ms))*H)/DAY);
// Words for a result of daylight(): {lines: for a card, short: for one line in a crowded panel}.
// Near the poles the sun can set after midnight (or rise before it), which is said so that "rise 02:55, set 00:03" is not a puzzle.
export function sunWords(s){const {today:a,yest:b,tz}=s,at=ms=>clock(tz,new Date(ms));
 if(a.state==='night')return{lines:['Polar night: the sun does not rise today'],short:'Polar night: no sunrise'};
 if(a.state==='day')return{lines:['Polar day: the sun does not set today','Daylight 24 h'],short:'Polar day: no sunset'};
 const ref=dayNo(tz,a.noon),rel=ms=>Math.sign(dayNo(tz,ms)-ref),
  word=ms=>['',' (next day)',' (previous day)'][rel(ms)<0?2:rel(ms)],mark=ms=>['',' +1',' −1'][rel(ms)<0?2:rel(ms)],
  ds=Math.round((a.len-b.len)/1000),
  vs=ds===0?'same as yesterday':`${secs(Math.abs(ds))} ${ds>0?'longer':'shorter'} than yesterday`;
 return{lines:[`Sunrise ${at(a.rise)}${word(a.rise)} · Sunset ${at(a.set)}${word(a.set)}`,`Daylight ${dur(a.len)} (${vs})`],
  short:`Sun ${at(a.rise)}${mark(a.rise)}–${at(a.set)}${mark(a.set)} · ${dur(a.len)}`}}
