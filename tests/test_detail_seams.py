"""Borders in the zoomed-in outlines (site/detail-*.json) must stay shared between neighbours.

Level 1 is simplified, so it is compared with level 2 (the full outlines): for every pair of neighbouring countries the
sea slivers and overlaps along their border may not grow much beyond what level 2 already has (rivers, bays, rounding).
Needs shapely.  Run from the repo root:  python3 -m unittest discover tests
"""

import json
import os
import re
import unittest

from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

SITE = os.path.join(os.path.dirname(__file__), '..', 'site')


def current_file(key):
    with open(os.path.join(SITE, 'js', 'data-files.js'), encoding='utf-8') as f:
        text = f.read()
    return os.path.join(SITE, re.search(rf'"{re.escape(key)}":"([^"]+)"', text).group(1))


def ring(flat, q):
    x = y = 0
    out = []
    for i in range(0, len(flat), 2):
        x += flat[i]
        y += flat[i + 1]
        out.append((x / q, y / q))
    return out


def load(key):
    with open(current_file(key), encoding='utf-8') as f:
        d = json.load(f)
    q = d['q']
    return {name: unary_union([Polygon(ring(p[0], q), [ring(h, q) for h in p[1:]]).buffer(0) for p in e['g']]) for name, e in d['f'].items()}


def border_pairs(ref):
    """Pairs of countries that touch in `ref`."""
    names = list(ref)
    tree = STRtree([ref[n] for n in names])
    for n in names:
        for j in tree.query(ref[n].buffer(0.005)):
            m = names[j]
            if m > n and ref[n].buffer(0.003).intersection(ref[m].buffer(0.003)).area >= 1e-5:
                yield n, m


def seam(a, b):
    """(sea sliver area, overlap area) between two outlines, in square degrees."""
    gap = a.buffer(0.06).intersection(b.buffer(0.06)).difference(a.union(b)).area
    return gap, a.intersection(b).area


class DetailSeams(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fine, cls.coarse = load('detail-2.json'), load('detail-1.json')
        cls.extra = {}
        for n, m in border_pairs(cls.fine):
            g2, o2 = seam(cls.fine[n], cls.fine[m])
            g1, o1 = seam(cls.coarse[n], cls.coarse[m])
            cls.extra[(n, m)] = max(0, g1 - g2) + max(0, o1 - o2)

    def test_no_border_gets_a_visible_sliver(self):
        worst = sorted(self.extra.items(), key=lambda kv: -kv[1])[:3]
        self.assertLess(worst[0][1], 0.08, worst)  # 0.055 at the time of writing (Brazil / Guyana); 0.10 before

    def test_total_stays_low(self):
        # about 0.6 at the time of writing; simplifying every outline on its own gave about 2.9
        self.assertLess(sum(self.extra.values()), 1.2)

    def test_morocco_and_western_sahara_meet_on_one_line(self):
        self.assertLess(self.extra[('Morocco', 'Western Sahara')], 0.01)  # 0.07 with independent simplification


if __name__ == '__main__':
    unittest.main()
