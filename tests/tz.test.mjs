// Tests for the daylight-saving logic in site/js/tz.js.  Run from the repo root:  node --test tests/
// The page's clock is Date.now() plus a shift, so fixing Date.now() is enough to look at any date.
import test from 'node:test';
import assert from 'node:assert/strict';

const tz = await import('../site/js/tz.js');
const at = iso => {
    const t = Date.parse(iso);
    Date.now = () => t;
    tz.setShift(0); // drops the cached look-ahead
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
