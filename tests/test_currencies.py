"""The currency data behind the Currencies map (site/currencies.<hash>.json, built by tools/build_currencies.py).

Checks that every country on the globe has a currency (Antarctica has none), that currencies whose countries touch never share a
colour slot (the whole point of the colouring) and that the palette has enough slots, and a few facts that are easy to get wrong
and do change (the euro area, dollarised countries).  Needs shapely.  Run from the repo root:  python3 -m unittest discover tests
"""

import json
import os
import re
import unittest

from shapely.geometry import shape
from shapely.strtree import STRtree

SITE = os.path.join(os.path.dirname(__file__), '..', 'site')
NEAR = 0.5  # degrees, as in tools/build_currencies.py


def current_file(key):
    with open(os.path.join(SITE, 'js', 'data-files.js'), encoding='utf-8') as f:
        text = f.read()
    return os.path.join(SITE, re.search(rf'"{re.escape(key)}":"([^"]+)"', text).group(1))


def load_countries():
    with open(os.path.join(SITE, 'countries.js'), encoding='utf-8') as f:
        text = f.read()
    data = json.loads(text[text.index('{') : text.rindex('}') + 1])
    return {f['properties']['n']: shape(f['geometry']).buffer(0) for f in data['features']}


with open(current_file('currencies.json'), encoding='utf-8') as f:
    DATA = json.load(f)
COUNTRIES = load_countries()
M, C = DATA['m'], DATA['c']


class Currencies(unittest.TestCase):
    def test_every_country_has_a_currency(self):
        self.assertEqual(set(COUNTRIES) - set(M), {'Antarctica'})
        self.assertEqual(set(M) - set(COUNTRIES), set())

    def test_codes_are_defined(self):
        for name, code in {**M, **DATA['a']}.items():
            self.assertIn(code, C, name)
        for code, (name, symbol, family, slot) in C.items():
            self.assertTrue(name and family, code)
            self.assertIsInstance(slot, int, code)

    def test_touching_currencies_have_different_colours(self):
        names = list(M)
        tree = STRtree([COUNTRIES[n] for n in names])
        clashes = set()
        for i, n in enumerate(names):
            for j in tree.query(COUNTRIES[n].buffer(NEAR)):
                m = names[j]
                if m != n and M[m] != M[n] and C[M[m]][3] == C[M[n]][3]:
                    clashes.add(tuple(sorted((n, m))))
        self.assertEqual(clashes, set())

    def test_the_palette_has_enough_slots(self):
        with open(os.path.join(SITE, 'js', 'palette.js'), encoding='utf-8') as f:
            hues = re.search(r'CUR_HUES=\[([^\]]*)\]', f.read()).group(1).split(',')
        used = {C[code][3] for code in M.values()}
        self.assertLess(max(used), len(hues))

    def test_known_currencies(self):
        self.assertEqual(M['Bulgaria'], 'EUR')  # joined the euro area on 1 January 2026
        self.assertEqual(M['Croatia'], 'EUR')
        self.assertEqual(M['Ukraine'], 'UAH')
        self.assertEqual(M['Zimbabwe'], 'ZWG')
        self.assertEqual(M['Curaçao'], 'XCG')
        self.assertEqual(M['Sint Maarten'], 'XCG')
        for dollarised in ('Ecuador', 'El Salvador', 'East Timor', 'Puerto Rico', 'Palau'):
            self.assertEqual(M[dollarised], 'USD', dollarised)
        self.assertEqual(M['Kosovo'], 'EUR')
        self.assertEqual(M['Western Sahara'], M['Morocco'])
        self.assertEqual(DATA['a']['Panama'], 'USD')


if __name__ == '__main__':
    unittest.main()
