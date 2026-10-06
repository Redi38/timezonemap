"""Time-zone helpers for the build scripts: tzdata access, zone.tab, offset behaviour, zone names.

Everything about how a zone is named, compared or looked up lives here, so build_zones.py only
deals with geometry.  site/js/tz.js is the page-side counterpart (names, offsets, DST).

Zones are IANA names ('Europe/Kyiv').  Antarctica has no official time, so its map wedges use the
whole-hour Etc/ zones; fixed_zone() builds those names from a UTC offset, because Etc/GMT+6 is
UTC-6 and is easy to get backwards.
"""
import datetime as dt
import os
import re
import zoneinfo
from collections import defaultdict

import tzdata

zoneinfo.reset_tzpath(to=[])          # use the tzdata package, not the OS copy
TZDIR = os.path.join(os.path.dirname(tzdata.__file__), 'zoneinfo')
UTC = dt.timezone.utc

MATCH_MIN = 0.90       # minimum offset-history similarity to call two zones the same


# ---------------------------------------------------------------- names
def zone_city(name):
    """'America/Port_of_Spain' -> 'Port of Spain': the zone as a place name (the one spot a capital table could hook in)."""
    return name.split('/')[-1].replace('_', ' ')


def is_conventional(name):
    """True for the made-up whole-hour Etc/ zones (Etc/UTC, Etc/GMT+6...)."""
    return name.startswith('Etc/')


def fixed_zone(hours):
    """The whole-hour zone for UTC+hours.  The Etc/GMT sign is inverted: fixed_zone(-6) is 'Etc/GMT+6'."""
    return 'Etc/UTC' if hours == 0 else 'Etc/GMT%+d' % -hours


# ---------------------------------------------------------------- offset behaviour
HIST = [dt.datetime(y, m, 15, tzinfo=UTC) for y in range(1970, 2038) for m in range(1, 13)]
FWD = [dt.datetime(y, m, d, tzinfo=UTC) for y in range(2026, 2038) for m in range(1, 13) for d in (1, 15)]
_sig = {}

def sig(name, samples=HIST):
    """The zone's UTC offset in seconds at each sample time."""
    key = (name, id(samples))
    if key not in _sig:
        z = zoneinfo.ZoneInfo(name)
        _sig[key] = tuple(int(d.astimezone(z).utcoffset().total_seconds()) for d in samples)
    return _sig[key]

def behaviour(name):
    """Zones with equal behaviour keys keep the same offsets from now on (2026-2037)."""
    return sig(name, FWD)

def offset_hours(name):
    """The zone's current UTC offset in hours."""
    return sig(name, FWD)[0] / 3600

def similarity(a, b):
    """Share of 1970-2037 months in which two zones had the same offset."""
    sa, sb = sig(a), sig(b)
    return sum(x == y for x, y in zip(sa, sb)) / len(sa)

def best_match(name, candidates):
    """(candidate, similarity) of the candidate that behaves most like `name`; an identical name wins ties."""
    best, bs = None, -1
    for c in candidates:
        s = similarity(name, c) + (1e-6 if c == name else 0)
        if s > bs:
            best, bs = c, s
    return best, bs


# ---------------------------------------------------------------- zone.tab
def parse_coord(s):
    m = re.match(r'([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$', s)
    la = int(m[2]) + int(m[3]) / 60 + int(m[4] or 0) / 3600
    lo = int(m[6]) + int(m[7]) / 60 + int(m[8] or 0) / 3600
    return (-lo if m[5] == '-' else lo, -la if m[1] == '-' else la)

def read_zone_tab():
    out = defaultdict(list)       # cc -> [(name, (lon, lat), comment)]
    for line in open(os.path.join(TZDIR, 'zone.tab'), encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        p = line.rstrip('\n').split('\t')
        out[p[0]].append((p[2], parse_coord(p[1]), p[3] if len(p) > 3 else ''))
    return out
