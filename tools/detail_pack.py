"""Packs the zoomed-in geometry made by `build_zones.py --detail` into the files the page loads.

There are two levels; the page fetches them as the globe is zoomed in:

  detail-1.json  outlines simplified to 0.03 degrees, on a 1/250-degree grid            used from 3x zoom
  detail-2.json  the full outlines, on a 1/500-degree grid                                  fetched past 4x zoom

so a visitor who only zooms in a little never downloads the fine one.

Format (TopoJSON-style quantization, without the shared arcs):

  {"v":2, "q":Q, "f":{name:{"g":[poly...], "c":[[lon,lat,r]...], "p":[{"z":[zone...], "g":[poly...], "c":[...]}...]}}}

  poly  [ring, ...], the exterior first, then holes
  ring  [x0, y0, dx1, dy1, dx2, dy2, ...]  integers in units of 1/Q degree: the first vertex, then every
        vertex relative to the one before.  The closing vertex (equal to the first) is left out.
  c     one cap [lon, lat, radius in radians] per polygon in g, for culling in the page
  p     the zone regions of countries with several zones (same layout as the country's own g and c)

Integer deltas are small numbers that compress very well; site/js/detail.js turns them back into
[lon, lat] pairs.  The grid is far finer than a pixel at the highest zoom (0.002 degrees is about
0.2 px at 12x), and neighbours that share a border quantize it identically.
"""
import math

from shapely.geometry import Polygon

LEVELS = [
    {'file': 'detail-1.json', 'q': 250, 'tol': 0.03},
    {'file': 'detail-2.json', 'q': 500, 'tol': 0},
]
DENSIFY_STEP = 0.25     # degrees; the same step build_zones.py uses, so long edges stay straight in lon/lat


def twice_area(pts):
    """Shoelace sum of a ring; the sign is its winding."""
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))


def simplify_polygon(poly, tol, densify):
    """Douglas-Peucker on one polygon (exterior and holes together, so they stay valid).

    Simplifying removes the extra points that densify() put on long straight edges, so they are put back.
    Returns the rings with their original winding, or the polygon unchanged if simplifying fails."""
    try:
        s = Polygon(poly[0], poly[1:]).simplify(tol, preserve_topology=True)
    except Exception:
        return poly
    if s.is_empty or s.geom_type != 'Polygon':
        return poly
    out = []
    for new, old in zip([s.exterior] + list(s.interiors), [poly[0]] + poly[1:]):
        pts = densify([tuple(c) for c in new.coords], DENSIFY_STEP)
        if twice_area(pts[:-1]) * twice_area([tuple(c) for c in old[:-1]]) < 0:
            pts.reverse()
        out.append([list(c) for c in pts])
    # holes can be dropped by simplify (collapsed); the exterior is always kept
    return out


def quantize_ring(pts, q):
    """Closed ring of [lon, lat] -> list of integer (x, y) on the 1/q grid, or None if it collapses."""
    out = []
    for x, y in pts:
        v = (math.floor(x * q + 0.5), math.floor(y * q + 0.5))
        if not out or out[-1] != v:
            out.append(v)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    if len(out) < 3 or twice_area(out) == 0:
        return None
    return out


def delta_encode(ring):
    flat, px, py = [], 0, 0
    for x, y in ring:
        flat += [x - px, y - py]
        px, py = x, y
    return flat


def pack_polygons(polys, q, tol, caps, densify):
    """(encoded polygons, caps) for a list of polygons; polygons or holes that collapse on the grid are dropped."""
    kept, shown = [], []
    for poly in polys:
        if tol and len(poly[0]) > 5:
            poly = simplify_polygon(poly, tol, densify)
        rings = []
        for i, ring in enumerate(poly):
            r = quantize_ring(ring, q)
            if r is None:
                if i == 0:
                    rings = None            # the exterior vanished: so does the polygon
                    break
                continue
            rings.append(r)
        if rings:
            kept.append([delta_encode(r) for r in rings])
            shown.append([[[x / q, y / q] for x, y in r] + [[r[0][0] / q, r[0][1] / q]] for r in rings])   # as the page sees it
    return kept, caps(shown)


def pack_level(detail, level, caps, densify):
    """The packed features of one level.  A country whose outline would vanish is left out (the page keeps its
    coarse outline); returns (features, names of the countries left out)."""
    q, tol = level['q'], level['tol']
    feats, lost = {}, []
    for name, e in detail.items():
        g, c = pack_polygons(e['g'], q, tol, caps, densify)
        if not g:
            lost.append(name)
            continue
        out = {'g': g, 'c': c}
        parts = []
        for part in e.get('p', []):
            pg, pc = pack_polygons(part['g'], q, tol, caps, densify)
            if pg:
                parts.append({'z': part['z'], 'g': pg, 'c': pc})
        if parts:
            out['p'] = parts
        feats[name] = out
    return feats, lost
