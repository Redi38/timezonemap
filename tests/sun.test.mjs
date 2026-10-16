// Tests for the sun maths in site/js/sun.js and the wording around it in site/js/daylight.js.  Run from the repo root:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

const sun = await import('../site/js/sun.js');
const { daylight, sunWords } = await import('../site/js/daylight.js');
const tz = await import('../site/js/tz.js');

const H = 36e5;
const DAY = 24 * H;
// About local solar noon of a date at a longitude: the instant sunDay() is asked about.
const noonOf = (date, lon) => Date.parse(date + 'T12:00:00Z') - (lon / 15) * H;
const hours = ms => ms / H;
const minutes = ms => ms / 6e4;

// Sunrise and sunset from an independent implementation (the suncalc library), UTC, to the minute.
// [place, longitude, latitude, date, sunrise, sunset]
const REF = [
    ['Kyiv', 30.52, 50.45, '2026-06-21', '2026-06-21T01:46Z', '2026-06-21T18:13Z'],
    ['Kyiv', 30.52, 50.45, '2026-12-21', '2026-12-21T05:55Z', '2026-12-21T13:56Z'],
    ['Sydney', 151.21, -33.87, '2026-12-21', '2026-12-20T18:40Z', '2026-12-21T09:05Z'],
    ['Quito', -78.47, -0.18, '2026-03-20', '2026-03-20T11:18Z', '2026-03-20T23:24Z'],
    ['Reykjavik', -21.9, 64.15, '2026-06-21', '2026-06-21T02:54Z', '2026-06-22T00:03Z'],
    ['Cape Town', 18.42, -33.92, '2026-06-21', '2026-06-21T05:51Z', '2026-06-21T15:44Z'],
];

test('sunrise and sunset agree with an independent implementation to within two minutes', () => {
    for (const [name, lon, lat, date, rise, set] of REF) {
        const d = sun.sunDay(lat, lon, noonOf(date, lon));
        assert.equal(d.state, 'normal', name);
        assert.ok(Math.abs(minutes(d.rise - Date.parse(rise))) < 2, `${name} sunrise is ${new Date(d.rise).toISOString()}, expected ${rise}`);
        assert.ok(Math.abs(minutes(d.set - Date.parse(set))) < 2, `${name} sunset is ${new Date(d.set).toISOString()}, expected ${set}`);
        assert.equal(d.len, d.set - d.rise, name);
    }
});

test('transit is the moment the sun is due south or north of a longitude', () => {
    for (const lon of [-157.4, -78.5, 0, 30.5, 151.2]) {
        const t = sun.transit(lon, Date.parse('2026-10-16T09:00:00Z'));
        assert.ok(Math.abs(sun.sunPoint(t)[0] - lon) < 0.01, `lon ${lon}`);
    }
});

test('polar day and polar night', () => {
    const at = (lat, lon, date) => sun.sunDay(lat, lon, noonOf(date, lon));
    let d = at(69.65, 18.96, '2026-06-21'); // Tromso
    assert.deepEqual([d.state, d.len], ['day', DAY]);
    d = at(69.65, 18.96, '2026-12-21');
    assert.deepEqual([d.state, d.len], ['night', 0]);
    assert.equal(at(-77.85, 166.67, '2026-12-21').state, 'day'); // McMurdo: the other way round
    assert.equal(at(-77.85, 166.67, '2026-06-21').state, 'night');
    d = at(60.17, 24.94, '2026-06-21'); // Helsinki: long, but the sun does set
    assert.equal(d.state, 'normal');
    assert.ok(hours(d.len) > 18.5 && hours(d.len) < 19.5, `${hours(d.len)} h`);
});

test('near the equator the day is about twelve hours all year', () => {
    for (let m = 1; m <= 12; m++) {
        const d = sun.sunDay(-0.18, -78.47, noonOf(`2026-${String(m).padStart(2, '0')}-15`, -78.47)); // Quito
        assert.ok(hours(d.len) > 12 && hours(d.len) < 12.25, `month ${m}: ${hours(d.len)} h`);
    }
});

test('in the north the day is longest at the June solstice and shortest at the December one', () => {
    let longest = [0, -1],
        shortest = [0, 99];
    for (let i = 0; i < 365; i++) {
        const len = hours(sun.sunDay(50.45, 30.52, noonOf('2026-01-01', 30.52) + i * DAY).len);
        if (len > longest[1]) longest = [i, len];
        if (len < shortest[1]) shortest = [i, len];
    }
    const doy = date => (Date.parse(date) - Date.parse('2026-01-01')) / DAY;
    assert.ok(Math.abs(longest[0] - doy('2026-06-21')) <= 2, `longest on day ${longest[0]}`);
    assert.ok(Math.abs(shortest[0] - doy('2026-12-21')) <= 2, `shortest on day ${shortest[0]}`);
});

test('daylight() puts the clock times in the place\'s own zone, also where that is far from its solar time', () => {
    const places = [
        ['Kyiv', [30.52, 50.45], 'Europe/Kyiv'],
        ['Kashgar', [75.99, 39.47], 'Asia/Shanghai'], // one time zone for all of China: the sun is 2 hours late
        ['Kiritimati', [-157.4, 1.87], 'Pacific/Kiritimati'], // UTC+14, across the date line from its longitude
        ['Sydney', [151.21, -33.87], 'Australia/Sydney'],
    ];
    for (const [name, ll, z] of places) {
        for (const iso of ['2026-03-20T09:00:00Z', '2026-06-21T09:00:00Z', '2026-10-16T09:00:00Z']) {
            const s = daylight(ll, z, new Date(iso)).today;
            assert.ok(s.rise < s.noon && s.noon < s.set, `${name} ${iso}`);
            const localHour = ms => (ms + tz.offOf(z, new Date(ms)) * H) / H % 24;
            assert.ok(Math.abs(localHour(s.noon) - 12) < 4, `${name} ${iso}: solar noon at ${localHour(s.noon)} local`);
        }
    }
});

const firstTime = (text, label) => {
    const m = text.match(new RegExp(label + ' (\\d\\d):(\\d\\d)'));
    assert.ok(m, `"${label} hh:mm" in "${text}"`);
    return +m[1] * 60 + +m[2];
};

test('sunrise follows the clocks across a daylight saving change', () => {
    const kyiv = iso => sunWords(daylight([30.52, 50.45], 'Europe/Kyiv', new Date(iso))).lines[0];
    const before = firstTime(kyiv('2026-10-24T09:00:00Z'), 'Sunrise'), // clocks go back during the night
        after = firstTime(kyiv('2026-10-25T09:00:00Z'), 'Sunrise');
    assert.ok(after - before < -50 && after - before > -70, `sunrise moved by ${after - before} min`);
});

test('the words: times, length of daylight, and the change since yesterday', () => {
    const kyiv = iso => sunWords(daylight([30.52, 50.45], 'Europe/Kyiv', new Date(iso)));
    let w = kyiv('2026-10-16T09:00:00Z');
    assert.match(w.lines[0], /^Sunrise \d\d:\d\d · Sunset \d\d:\d\d$/);
    assert.match(w.lines[1], /^Daylight 10 h \d+ min \(\d+ min \d+ s shorter than yesterday\)$/); // October: days are getting shorter
    assert.match(w.short, /^Sun \d\d:\d\d–\d\d:\d\d · 10 h \d+ min$/);
    assert.ok(Math.abs(firstTime(w.lines[0], 'Sunrise') - (7 * 60 + 21)) <= 3, w.lines[0]);
    w = kyiv('2026-02-14T09:00:00Z');
    assert.match(w.lines[1], /longer than yesterday\)$/); // February: getting longer
    // plain lengths: whole hours have no minutes, and a minute count never reads "60 min"
    for (let i = 0; i < 365; i += 5) {
        const t = sunWords(daylight([30.52, 50.45], 'Europe/Kyiv', new Date(Date.UTC(2026, 0, 1 + i, 9))));
        assert.doesNotMatch(t.lines[1], /\b60 min|\b0 min/, t.lines[1]);
    }
});

test('the words: polar day and night, and a sunset after midnight', () => {
    const at = (ll, z, iso) => sunWords(daylight(ll, z, new Date(iso)));
    assert.match(at([18.96, 69.65], 'Europe/Oslo', '2026-06-21T09:00:00Z').lines[0], /^Polar day/);
    assert.match(at([18.96, 69.65], 'Europe/Oslo', '2026-12-21T09:00:00Z').lines[0], /^Polar night/);
    const r = at([-21.9, 64.15], 'Atlantic/Reykjavik', '2026-06-21T09:00:00Z'); // sunset 00:03, the next day
    assert.match(r.lines[0], /Sunset 00:\d\d \(next day\)$/);
    assert.match(r.short, /–00:\d\d \+1 · /);
});

test('the clock times follow the 12/24-hour setting', () => {
    try {
        tz.setH12(true);
        const w = sunWords(daylight([30.52, 50.45], 'Europe/Kyiv', new Date('2026-10-16T09:00:00Z')));
        assert.match(w.lines[0], /^Sunrise \d\d:\d\d [ap]m · Sunset \d\d:\d\d [ap]m$/i);
    } finally {
        tz.setH12(false);
    }
});
