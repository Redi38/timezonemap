#!/usr/bin/env python3
"""Add per-time-zone geometry to the countries in site/index.html.

The page ships one polygon per country plus a list of IANA zones (properties.z).
For countries that span more than one zone this script adds two feature-level keys
so the globe can draw every zone:

  parts  [{z, g, c, a, r}]  one region per group of zones that behave identically from
                         now on.  z: zone names, g: polygon coordinates (may reach a
                         little past the country - the page clips it to the country
                         outline), c: label point [lon, lat] inside the country,
                         a: area inside the country in steradians,
                         r: radius in radians of a cap around c that holds the whole region.
  marks  [{z, ll, n}]    zones whose land is too small for the country polygon
                         (islands, enclaves), drawn as a marker at ll=[lon, lat].

properties.z is trimmed to zones that really exist inside the country.

Usage:  python3 tools/build_zones.py            rewrites site/index.html
        python3 tools/build_zones.py --detail   writes site/detail.json (run it after the line above)
        add --check to either to report only and write nothing

--detail builds the high-resolution geometry the page loads when zoomed in: Natural Earth 10m
country outlines (downloaded once into tools/.cache) and the same zone regions rebuilt at a
fine tolerance and clipped to those outlines.  detail.json maps feature name ->
{g: polygons, c: cap per polygon, p: [{z, g, c}]} (p only for countries that have zone regions).

Requires: pip install timezonefinder shapely tzdata
Geometry is timezone-boundary-builder (via timezonefinder).  Its zone names come from
zone.tab while the page uses zone1970.tab names, so zones are matched by comparing
their UTC-offset history from 1970 to 2037.
"""
import datetime as dt
import json
import math
import os
import re
import sys
import zoneinfo
from collections import defaultdict

import shapely
import tzdata
from shapely.geometry import MultiPolygon, Point, Polygon, box, shape
from shapely.ops import unary_union
from timezonefinder import TimezoneFinder

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, '..', 'site', 'index.html')
CHECK = '--check' in sys.argv
DETAIL = '--detail' in sys.argv
DETAIL_OUT = os.path.join(HERE, '..', 'site', 'detail.json')
NE_FILE = os.path.join(HERE, '.cache', 'ne_10m_admin_0_countries.geojson')
NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson'
DET_TOL = 0.006        # degrees (~600 m); detail outlines are simplified by this much

SIMPLIFY = (0.04, 0.15)  # degrees; zone borders are simplified more in bigger countries
REACH = 0.7            # degrees the regions extend past the country outline
MIN_AREA = 1e-4        # deg^2; smaller pieces are dropped (scaled down for tiny islands)
DIGITS = 2             # decimals kept in output coordinates
if DETAIL:
    SIMPLIFY, REACH, MIN_AREA, DIGITS = (0.006, 0.03), 0.12, 2e-5, 3
MATCH_MIN = 0.90       # minimum offset-history similarity to call two zones the same

# ISO codes for features that can hold several zones (the page only has names).
CC = {
    'United States of America': 'US', 'Russia': 'RU', 'Canada': 'CA', 'Brazil': 'BR',
    'Australia': 'AU', 'Argentina': 'AR', 'Mexico': 'MX', 'Kazakhstan': 'KZ',
    'Indonesia': 'ID', 'Chile': 'CL', 'Greenland': 'GL', 'Spain': 'ES', 'Portugal': 'PT',
    'French Polynesia': 'PF', 'Kiribati': 'KI', 'Federated States of Micronesia': 'FM',
    'Malaysia': 'MY', 'Cyprus': 'CY', "People's Republic of China": 'CN', 'Palestine': 'PS',
    'Democratic Republic of the Congo': 'CD', 'Ukraine': 'UA', 'Uzbekistan': 'UZ',
    'Mongolia': 'MN', 'Germany': 'DE', 'Vietnam': 'VN', 'Ecuador': 'EC',
    'Papua New Guinea': 'PG', 'New Zealand': 'NZ', 'French Southern and Antarctic Lands': 'TF',
    'Marshall Islands': 'MH', 'United States Minor Outlying Islands': 'UM', 'France': 'FR',
}
# The page lists only Europe/Paris for France, but its overseas departments are in other zones.
# Zones added to a country's list, and the extra country codes whose zone.tab places belong to it.
EXTRA_ZONES = {
    'France': ['America/Cayenne', 'America/Martinique', 'America/Guadeloupe', 'Indian/Reunion', 'Indian/Mayotte'],
}
EXTRA_CC = {'France': ['GP', 'MQ', 'RE', 'YT', 'GF']}
# Zones removed from a country's list: their land is listed under (and takes the time of) the country's
# main zone instead.  Crimea (Europe/Simferopol) is Ukrainian and follows Europe/Kyiv.
DROP_ZONES = {
    'Ukraine': {'Europe/Simferopol'},
    'Russia': {'Europe/Simferopol'},
}
# Small dependencies that inherited their parent country's whole zone list in the page.
# They get the zone(s) that really cover them, and no markers.
ISLANDS = {'Brazilian Island', 'Australian Indian Ocean Territories', 'Ashmore and Cartier Islands'}

zoneinfo.reset_tzpath(to=[])          # use the tzdata package, not the OS copy
TZDIR = os.path.join(os.path.dirname(tzdata.__file__), 'zoneinfo')
UTC = dt.timezone.utc


# ---------------------------------------------------------------- tz name matching
HIST = [dt.datetime(y, m, 15, tzinfo=UTC) for y in range(1970, 2038) for m in range(1, 13)]
FWD = [dt.datetime(y, m, d, tzinfo=UTC) for y in range(2026, 2038) for m in range(1, 13) for d in (1, 15)]
_sig = {}

def sig(name, samples=HIST):
    key = (name, id(samples))
    if key not in _sig:
        z = zoneinfo.ZoneInfo(name)
        _sig[key] = tuple(int(d.astimezone(z).utcoffset().total_seconds()) for d in samples)
    return _sig[key]

def similarity(a, b):
    sa, sb = sig(a), sig(b)
    return sum(x == y for x, y in zip(sa, sb)) / len(sa)

def best_match(name, candidates):
    best, bs = None, -1
    for c in candidates:
        s = similarity(name, c) + (1e-6 if c == name else 0)
        if s > bs:
            best, bs = c, s
    return best, bs

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


# ---------------------------------------------------------------- geometry helpers
min_area = MIN_AREA

def ring_area(r):
    return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2

def to_shapely(g):
    ps = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    return shapely.make_valid(MultiPolygon([Polygon(p[0], p[1:]) for p in ps]))

def polys(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    if hasattr(g, 'geoms'):
        return [p for x in g.geoms for p in polys(x)]
    return []

def clean(g):
    g = shapely.make_valid(g) if not g.is_valid else g
    return unary_union([p for p in polys(g) if p.area >= min_area])

def rnd(v):
    return round(v + 0.0, DIGITS)

def densify(coords, step):
    """Insert points along every edge longer than `step` degrees, straight in lon/lat.

    A long edge such as the 49th parallel is drawn by d3 as a great-circle arc, which bows away from the
    parallel, and each neighbour of a shared border would bow differently.  Short edges make every renderer
    draw the same line."""
    out = [coords[0]]
    for a, b in zip(coords, coords[1:]):
        n = 1 if abs(b[0] - a[0]) > 180 else math.ceil(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / step)
        for i in range(1, n):
            out.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))
        out.append(b)
    return out

def ring_out(r, clockwise, keep_pole=False):
    pts = []
    coords = densify(list(r.coords), 0.25) if DETAIL else r.coords
    for x, y in coords:
        q = [rnd(x), rnd(y)]
        if not pts or pts[-1] != q:
            pts.append(q)
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    if len(pts) < 4:
        return None
    if (ring_area(pts) < 0) != clockwise:
        pts.reverse()
    if not keep_pole and any(abs(q[1]) >= 89.99 for q in pts):
        # Antarctica: the file closes the ring along the pole, which d3 would stroke as a line from the coast
        # to the pole.  A ring that simply runs round the pole (lon -180 to 180 along the coast) needs no such seam.
        pts = [q for q in pts if abs(q[1]) < 89.99]
        if pts and pts[0] != pts[-1]:
            pts.append(pts[0])
        if len(pts) < 4:
            return None
    return pts

def geom_out(g, cw_exterior, keep_pole=False):
    """Polygon list in the winding d3 expects: exterior clockwise, holes counter-clockwise."""
    out = []
    for p in polys(g):
        ext = ring_out(p.exterior, cw_exterior, keep_pole)
        if not ext:
            continue
        holes = [h for h in (ring_out(i, not cw_exterior, keep_pole) for i in p.interiors) if h]
        out.append([ext] + holes)
    return out

def steradians(g):
    """Rough spherical area of a lon/lat shape."""
    a = 0.0
    for p in polys(g):
        c = p.representative_point()
        a += p.area * (math.pi / 180) ** 2 * math.cos(math.radians(c.y))
    return a

def simplify_for(area):
    lo, hi = SIMPLIFY
    return min(hi, max(lo, 0.012 * math.sqrt(area)))

def cap_radius(c, g):
    """Radians from c to the farthest vertex of g."""
    la0, lo0 = math.radians(c[1]), math.radians(c[0])
    r = 0.0
    for p in polys(g):
        for x, y in p.exterior.coords:
            la, lo = math.radians(y), math.radians(x)
            h = math.sin((la - la0) / 2) ** 2 + math.cos(la0) * math.cos(la) * math.sin((lo - lo0) / 2) ** 2
            r = max(r, 2 * math.asin(min(1.0, math.sqrt(h))))
    return r

def caps(plist):
    """[lon, lat, radius] per polygon: a cap (radius in radians) that holds it, for culling in the page."""
    out = []
    for poly in plist:
        ring = poly[0]
        xs, ys = [q[0] for q in ring], [q[1] for q in ring]
        c = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
        if max(xs) - min(xs) >= 359:             # a ring that runs round a pole: centre the cap on the pole
            c = (0.0, -90.0 if sum(ys) < 0 else 90.0)
        la0, lo0 = math.radians(c[1]), math.radians(c[0])
        r = 0.0
        for x, y in ring:
            la, lo = math.radians(y), math.radians(x)
            h = math.sin((la - la0) / 2) ** 2 + math.cos(la0) * math.cos(la) * math.sin((lo - lo0) / 2) ** 2
            r = max(r, 2 * math.asin(min(1.0, math.sqrt(h))))
        out.append([round(c[0], 2), round(c[1], 2), math.ceil((r + 0.0005) * 1000) / 1000])
    return out

def label_point(g):
    big = max(polys(g), key=lambda p: p.area)
    c = big.centroid
    if not big.contains(c):
        c = big.representative_point()
    return [rnd(c.x), rnd(c.y)]


def ne_features():
    """The Natural Earth 10m country features (downloaded once into tools/.cache)."""
    if not os.path.exists(NE_FILE):
        import urllib.request
        os.makedirs(os.path.dirname(NE_FILE), exist_ok=True)
        print('downloading', NE_URL, file=sys.stderr)
        urllib.request.urlretrieve(NE_URL, NE_FILE)
    return json.load(open(NE_FILE, encoding='utf-8'))['features']


# Antarctica has no official time.  The map shows the conventional zones by longitude (a wedge each, meeting at the
# pole); research stations often keep their own time instead, which the page says in the tooltip.
ANT_WEDGES = [      # (west lon, east lon, zone)
    (-180, -150, 'Antarctica/McMurdo'), (-150, -90, 'Etc/GMT+6'), (-90, -67, 'Etc/GMT+4'),
    (-67, -20, 'Etc/GMT+3'), (-20, 40, 'Etc/UTC'), (40, 60, 'Etc/GMT-3'), (60, 80, 'Etc/GMT-5'),
    (80, 100, 'Etc/GMT-6'), (100, 115, 'Etc/GMT-7'), (115, 135, 'Etc/GMT-8'), (135, 165, 'Etc/GMT-10'),
    (165, 180, 'Antarctica/McMurdo'),
]

def antarctica_geom():
    f = next(f for f in ne_features() if f['properties']['NAME_EN'] == 'Antarctica')
    g = shapely.make_valid(shape(f['geometry']))
    return g.simplify(0.006 if DETAIL else 0.15)

def antarctica_parts(g, cw_exterior):
    """Zone wedges of the Antarctic land; same fields as the other countries' parts."""
    merged = defaultdict(list)
    for x0, x1, z in ANT_WEDGES:
        piece = clean(g.intersection(box(x0, -90, x1, -60)))
        if not piece.is_empty:
            merged[z].append(piece)
    out = []
    for z, ps in merged.items():
        u = clean(unary_union(ps))
        gj = geom_out(u, cw_exterior, keep_pole=True)
        if not gj:
            continue
        if DETAIL:
            out.append({'z': [z], 'g': gj, 'c': caps(gj)})
        else:
            c = label_point(u)
            out.append({'z': [z], 'g': gj, 'c': c, 'a': float('%.3g' % steradians(u)),
                        'r': math.ceil(cap_radius(c, u) * 100) / 100})
    return out

def antarctica_feature(cw_exterior):
    g = antarctica_geom()
    g = unary_union([p for p in polys(g) if p.area >= 0.05])
    parts = antarctica_parts(g, cw_exterior)
    return {'type': 'Feature', 'properties': {'n': 'Antarctica', 'z': list(dict.fromkeys(z for p in parts for z in p['z']))},
            'geometry': {'type': 'MultiPolygon', 'coordinates': geom_out(g, cw_exterior)}, 'parts': parts, 'marks': []}


def dumps_lines(head, items):
    """JSON with one item per line, so git diffs of the generated data stay small."""
    return head + '\n' + ',\n'.join(items) + '\n' + ('}}' if head.startswith('{"v"') else ']}')


def load_ne(base):
    """Natural Earth 10m outlines for the page's features, simplified for the page.

    The page's own (coarse) outlines decide who owns what, so the detail layer agrees with it:
    Natural Earth features the page does not have (Somaliland, Kosovo, Northern Cyprus, Baikonur, ...) are
    merged into the country whose page outline contains them, and large pieces the page gives to another
    country are moved (Crimea is Ukrainian here, Natural Earth puts it in Russia).
    base: page feature name -> shapely geometry.
    """
    from shapely.strtree import STRtree
    names = list(base)
    tree = STRtree([base[n] for n in names])
    pieces = defaultdict(list)
    touched = set()
    for f in ne_features():
        nm = f['properties']['NAME_EN']
        g = shapely.make_valid(shape(f['geometry'])).simplify(DET_TOL)
        for p in polys(g):
            if p.area < 2e-6:
                continue
            owner = nm if nm in base else None
            if owner is None or (p.area >= 1.0 and not base[owner].contains(p.representative_point())):
                rp = p.representative_point()
                hit = [names[i] for i in tree.query(rp, predicate='within')]
                if hit:
                    owner = hit[0]
                elif owner is None:
                    near = names[tree.nearest(rp)]
                    if base[near].distance(rp) < 1.5:
                        owner = near
                if owner is not None and owner != nm:
                    touched.add(owner)
                    print(f'  {nm} ({p.area:.3f} deg2) -> {owner}', file=sys.stderr)
            if owner is None:
                print(f'  dropped {nm} ({p.area:.3f} deg2): not near any page feature', file=sys.stderr)
                continue
            pieces[owner].append(p)
    out = {}
    for n, ps in pieces.items():
        g = unary_union(ps)
        if n in touched:        # close the hairline gaps between pieces that came from different features
            g = g.buffer(0.003, join_style=2).buffer(-0.003, join_style=2)
        out[n] = g
    return out


# ---------------------------------------------------------------- main
def main():
    global min_area
    src = open(HTML, encoding='utf-8').read()
    m = re.search(r'const DATA=(\{.*?\});\nconst F=', src, re.S)
    data = json.loads(m.group(1))
    tf = TimezoneFinder()
    ztab = read_zone_tab()
    geom_cache = {}
    world = box(-180, -90, 180, 90)

    first = next(f for f in data['features'] if f['geometry']['type'] in ('Polygon', 'MultiPolygon'))
    g0 = first['geometry']['coordinates']
    cw_exterior = ring_area(g0[0] if first['geometry']['type'] == 'Polygon' else g0[0][0]) < 0

    if not DETAIL:      # rebuilt on every run so the outline always matches this script
        data['features'] = [f for f in data['features'] if f['properties']['n'] != 'Antarctica']
        data['features'].append(antarctica_feature(cw_exterior))

    def tz_geometry(name):
        if name not in geom_cache:
            rings = tf.get_geometry(tz_name=name, coords_as_pairs=True)
            ps = [shapely.make_valid(Polygon(p[0], p[1:])) for p in rings]
            geom_cache[name] = shapely.make_valid(unary_union(ps)).simplify(SIMPLIFY[0])
        return geom_cache[name]

    report = []
    ne = load_ne({f['properties']['n']: shapely.make_valid(to_shapely(f['geometry'])).buffer(0) for f in data['features']}) if DETAIL else None
    detail = {}
    for f in data['features']:
        name = f['properties']['n']
        zones = list(dict.fromkeys(f['properties'].get('z', [])))
        had_parts = 'parts' in f
        ant = (f.get('parts'), f.get('marks'))
        for k in ('parts', 'borders', 'marks'):
            f.pop(k, None)
        if DETAIL:
            if name not in ne:
                print('no detailed outline for', name, file=sys.stderr)
                continue
            gj = geom_out(ne[name], cw_exterior)
            detail[name] = {'g': gj, 'c': caps(gj)}
            if name == 'Antarctica':
                detail[name]['p'] = antarctica_parts(unary_union([p for p in polys(antarctica_geom()) if p.area >= 0.05]), cw_exterior)
                continue
            if not had_parts:
                continue
        if name == 'Antarctica':
            f['parts'], f['marks'] = ant
            continue
        if name in EXTRA_ZONES:
            zones = list(dict.fromkeys(zones + EXTRA_ZONES[name]))
            f['properties']['z'] = zones
        if name in DROP_ZONES:
            zones = [z for z in zones if z not in DROP_ZONES[name]]
            f['properties']['z'] = zones
        island = name in ISLANDS
        if not island and (len(zones) < 2 or name not in CC):
            continue
        cc = CC.get(name)

        raw = ne[name] if DETAIL else to_shapely(f['geometry'])
        min_area = min(MIN_AREA, raw.area * 0.01)
        C = clean(raw)
        tol = simplify_for(C.area)
        E = unary_union([world.intersection(C.buffer(REACH).simplify(REACH * 0.55))])

        # 1. which geometry zones sit inside this country?
        found = set()
        for p in polys(C):
            rp = p.representative_point()
            found.add(tf.timezone_at(lng=rp.x, lat=rp.y))
            minx, miny, maxx, maxy = p.bounds
            step = max(0.1, min(1.0, ((maxx - minx) * (maxy - miny)) ** 0.5 / 70))
            xs, ys, y = [], [], miny
            while y <= maxy:
                x = minx
                while x <= maxx:
                    xs.append(x); ys.append(y); x += step
                y += step
            if xs:
                for x, y, ok in zip(xs, ys, shapely.contains_xy(p, xs, ys)):
                    if ok:
                        found.add(tf.timezone_at(lng=x, lat=y))
        found = {t for t in found if t and not t.startswith('Etc/')}
        if island and found:
            zones = sorted(found)       # else keep the inherited list; the nearest-offset fallback picks one

        # 2. clip each geometry zone to the reach area, name it after the page's zone
        by_z = defaultdict(list)
        weak = []
        for t in sorted(found):
            piece = clean(tz_geometry(t).intersection(E).simplify(tol))
            if piece.is_empty or piece.area < min_area:
                continue
            if not zones:
                continue
            z, s = best_match(t, zones)
            if s < MATCH_MIN:
                weak.append(t)          # a neighbour's zone overlapping the coarse outline
                continue
            by_z[z].append(piece)

        # 3. zone.tab places inside this country for zones that got no land
        marks = {}
        if cc and not island:
            for t, ll, comment in [r for c in [cc] + EXTRA_CC.get(name, []) for r in ztab.get(c, [])]:
                z, s = best_match(t, zones)
                if s >= MATCH_MIN and z not in by_z and z not in marks:
                    marks[z] = {'z': z, 'll': [rnd(ll[0]), rnd(ll[1])], 'n': comment or t.split('/')[-1].replace('_', ' ')}

        # 4. merge zones that behave identically from now on
        cls = {}
        for z in zones:
            cls.setdefault(sig(z, FWD), []).append(z)
        cls_of = {z: k for k, zs in cls.items() for z in zs}
        geo = defaultdict(list)
        for z, ps in by_z.items():
            geo[cls_of[z]] += ps
        order = sorted(geo, key=lambda k: -sum(p.area for p in geo[k]))
        parts, taken = {}, None
        for k in order:
            g = clean(unary_union(geo[k]))
            if taken is not None:
                g = clean(g.difference(taken))
            if g.is_empty:
                continue
            parts[k] = g
            taken = g if taken is None else unary_union([taken, g])

        # 5. area no geometry zone claimed goes to the nearest zone
        anchors = dict(parts)
        for z, mk in marks.items():
            anchors.setdefault(cls_of[z], Point(mk['ll']))
        if not anchors and zones:
            lon = C.representative_point().x
            z = min(zones, key=lambda z: abs(sig(z, FWD)[0] / 3600 - lon / 15))
            anchors[cls_of[z]] = Point(0, 0)
        rest = E if taken is None else clean(E.difference(taken))
        # Unclaimed land (zone shapes rarely line up exactly with the country outline) goes to the zone that
        # is next to it: grow every zone outward in steps.  Giving a whole connected strip to one zone would
        # hand a long border to whichever zone merely touches it somewhere.
        if parts and not rest.is_empty:
            reach = 0.03 if DETAIL else 0.1
            while reach <= 6.5 and not rest.is_empty:
                claimed = None
                for k in list(parts):
                    got = clean(rest.intersection(parts[k].buffer(reach)))
                    if claimed is not None and not got.is_empty:
                        got = clean(got.difference(claimed))
                    if got.is_empty:
                        continue
                    parts[k] = clean(unary_union([parts[k], got]))
                    claimed = got if claimed is None else unary_union([claimed, got])
                if claimed is not None:
                    rest = clean(rest.difference(claimed))
                reach *= 2
            for k in parts:                   # buffering leaves many small arcs; thin them out again
                parts[k] = clean(parts[k].simplify(tol * 0.5))
            anchors = dict(parts) | {k: v for k, v in anchors.items() if k not in parts}
        extra = defaultdict(list)
        for piece in polys(rest):
            if anchors:
                extra[min(anchors, key=lambda k: anchors[k].distance(piece))].append(piece)
        for k, ps in extra.items():
            parts[k] = clean(unary_union(([parts[k]] if k in parts else []) + ps))

        for k in parts:                           # a marker is only needed where the zone has no land nearby
            for z in cls[k]:
                if z in marks and Point(marks[z]['ll']).distance(parts[k].intersection(C)) < 0.3:
                    marks.pop(z)
        marks = {z: mk for z, mk in marks.items() if not any(cls_of[z] == cls_of[o] for o in marks if o != z and o < z)}

        used = [z for z in zones if cls_of[z] in parts or z in marks]
        dropped = [z for z in zones if z not in used]
        f['properties']['z'] = used
        if not parts and not marks:
            report.append((name, len(zones), 0, 0, dropped, weak))
            continue

        out_parts = []
        for k in parts:
            inside = parts[k].intersection(C)
            if inside.is_empty:
                continue
            g = geom_out(parts[k], cw_exterior)
            if g and DETAIL:
                out_parts.append({'z': [z for z in used if cls_of[z] == k], 'g': g, 'c': caps(g)})
            elif g:
                c = label_point(inside)
                out_parts.append({'z': [z for z in used if cls_of[z] == k], 'g': g, 'c': c,
                                  'a': float('%.3g' % steradians(inside)),
                                  'r': math.ceil(cap_radius(c, parts[k]) * 100) / 100})
        groups = len(out_parts) + len(marks)
        if DETAIL:
            detail[name]['p'] = out_parts
        elif groups > 1 or marks:
            f['parts'] = out_parts
            f['marks'] = list(marks.values())
        report.append((name, len(zones), len(out_parts), len(marks), dropped, weak))

    print(f'{"feature":<38}{"zones":>6}{"parts":>6}{"marks":>6}  dropped zones | foreign zones skipped')
    for n, nz, np_, nm, dropped, weak in report:
        print(f'{n:<38}{nz:>6}{np_:>6}{nm:>6}  {",".join(dropped)} | {len(weak)}')

    if DETAIL:
        dump = lambda v: json.dumps(v, separators=(',', ':'), ensure_ascii=False)
        new = dumps_lines('{"v":1,"f":{', [dump(n) + ':' + dump(e) for n, e in detail.items()])
        print(f'DETAIL: {len(detail)} features, {len(new)} chars', file=sys.stderr)
        if not CHECK:
            open(DETAIL_OUT, 'w', encoding='utf-8').write(new)
            print('wrote', os.path.normpath(DETAIL_OUT), file=sys.stderr)
        return
    dump = lambda v: json.dumps(v, separators=(',', ':'), ensure_ascii=False)
    assert set(data) == {'type', 'features'}, 'unexpected keys in DATA'
    new = dumps_lines('{"type":"FeatureCollection","features":[', [dump(f) for f in data['features']])
    print(f'DATA: {len(m.group(1))} -> {len(new)} chars', file=sys.stderr)
    if not CHECK:
        open(HTML, 'w', encoding='utf-8').write(src[:m.start(1)] + new + src[m.end(1):])
        print('wrote', os.path.normpath(HTML), file=sys.stderr)


if __name__ == '__main__':
    main()
