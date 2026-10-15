// Tests for the daylight-saving logic in site/js/tz.js.  Run from the repo root:  node --test tests/
// The page's clock is Date.now() plus a shift, so fixing Date.now() is enough to look at any date.
import test from 'node:test';
import assert from 'node:assert/strict';

const tz = await import('../site/js/tz.js');
const at = iso => {
    const t = Date.parse(iso);
    Date.now = () => t;
    tz.setShift(0); // back to the real clock (the answers are cached by clock value, so nothing needs dropping)
};
// Number of offset/name lookups the browser is asked for while fn runs: a measure of how much work dstInfo does.
const lookups = fn => {
    const p = Intl.DateTimeFormat.prototype, orig = p.formatToParts;
    let n = 0;
    p.formatToParts = function (...a) {
        n++;
        return orig.apply(this, a);
    };
    try {
        fn();
    } finally {
        p.formatToParts = orig;
    }
    return n;
};

test('Morocco: a short pause in Ramadan is a pause, not summer and winter time', () => {
    for (const z of ['Africa/Casablanca', 'Africa/El_Aaiun']) {
        at('2026-10-11T12:00:00Z'); // Ramadan 2027 is ahead
        let i = tz.dstInfo(z);
        assert.ok(i.dst && i.special, z);
        assert.deepEqual([i.base, i.alt, i.ram], [1, 0, true], z);
        assert.equal(i.next, '7 Feb', z);

        at('2027-02-20T12:00:00Z'); // in the middle of it: the pause is under way
        i = tz.dstInfo(z);
        assert.ok(i.special, z);
        assert.equal(tz.offOf(z, tz.nowDate()), 0, z);
        assert.equal(i.next, '14 Mar', z);
    }
});

test('ordinary zones are not mistaken for pauses', () => {
    at('2026-10-11T12:00:00Z');
    const berlin = tz.dstInfo('Europe/Berlin');
    assert.ok(berlin.dst && !berlin.special);
    assert.deepEqual([berlin.sOff, berlin.wOff], [2, 1]);
    const sydney = tz.dstInfo('Australia/Sydney'); // southern hemisphere: the other way round
    assert.ok(sydney.dst && !sydney.special);
    assert.deepEqual([sydney.sOff, sydney.wOff], [11, 10]);
    assert.equal(tz.dstInfo('Asia/Tokyo').dst, false);
    assert.equal(tz.dstInfo('Asia/Kolkata').dst, false);
});

test('only Morocco and Western Sahara pause, among every zone the runtime knows', () => {
    at('2026-10-11T12:00:00Z');
    const specials = Intl.supportedValuesOf('timeZone').filter(z => tz.dstInfo(z).special);
    assert.deepEqual(specials.sort(), ['Africa/Casablanca', 'Africa/El_Aaiun']);
});

test('zones with the same behaviour share a rule key, others do not', () => {
    at('2026-10-11T12:00:00Z');
    const d = tz.nowDate();
    assert.equal(tz.zoneRule('Africa/Casablanca', d).k, tz.zoneRule('Africa/El_Aaiun', d).k);
    assert.notEqual(tz.zoneRule('Africa/Casablanca', d).k, tz.zoneRule('Europe/London', d).k);
});

test('moving the clock a little (the time slider) does not search for clock changes again', () => {
    const zones = Intl.supportedValuesOf('timeZone');
    at('2030-01-15T12:00:00Z'); // far from anything looked at so far, so every zone starts from scratch
    const cold = lookups(() => zones.forEach(z => tz.dstInfo(z)));
    const moved = lookups(() => {
        for (const min of [15, 60, 180]) {
            tz.setShift(min * 6e4);
            zones.forEach(z => tz.dstInfo(z));
        }
    });
    assert.ok(cold > 10000, `a first look should be expensive, got ${cold} lookups`);
    assert.ok(moved < cold / 20, `three slider moves took ${moved} lookups, a first look took ${cold}`);
});

test('the answer follows the clock across a clock change and back again', () => {
    at('2026-10-24T12:00:00Z'); // Berlin ends daylight saving at 01:00 UTC the next night
    const read = () => {
        const i = tz.dstInfo('Europe/Berlin');
        assert.ok(i.dst && !i.special);
        assert.deepEqual([i.sOff, i.wOff], [2, 1]);
        return i.next;
    };
    assert.equal(read(), '25 Oct');
    tz.setShift(24 * 36e5); // the slider's limit: the change has happened
    assert.equal(tz.offOf('Europe/Berlin', tz.nowDate()), 1);
    assert.equal(read(), '28 Mar');
    tz.setShift(0); // and back
    assert.equal(tz.offOf('Europe/Berlin', tz.nowDate()), 2);
    assert.equal(read(), '25 Oct');
});

test('a clock far from the one the look-ahead was made for gets a fresh look-ahead', () => {
    at('2026-10-11T12:00:00Z');
    assert.equal(tz.dstInfo('Europe/Berlin').next, '25 Oct');
    at('2027-06-01T12:00:00Z'); // months later: a stale table would still say October 2026
    assert.equal(tz.dstInfo('Europe/Berlin').next, '31 Oct');
});
