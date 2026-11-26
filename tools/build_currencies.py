#!/usr/bin/env python3
"""Writes site/currencies.<hash>.json (see data_files.py): the currency of every country on the globe, for the Currencies map.

Sources: geonamescache (GeoNames) for the currency code of each country, Babel (Unicode CLDR) for the English name and symbol of
each currency.  The country names come from site/countries.js, so every feature on the globe is covered.  Run:
    pip install -r requirements.txt && python3 tools/build_currencies.py        (add --check to report without writing)

Format: {"v":1,
         "c": {code: [name, symbol, family, colour slot], ...},   symbol is "" when it is the code itself; family is "Dollar", "Peso", ...
         "m": {country name on the globe: code},                  countries with no currency (Antarctica) are left out
         "a": {country name: code}}                               a second currency widely accepted there (see ALSO)

Colour slots: currencies that touch (countries within NEAR degrees of each other) never share a slot, so neighbours can always be
told apart on the map.  The slots themselves are drawn from the palette in site/js/palette.js.
"""

import json, os, re, sys, unicodedata
import geonamescache
from babel.numbers import get_currency_name, get_currency_symbol
from shapely.geometry import shape
from shapely.strtree import STRtree
from data_files import publish

HERE = os.path.dirname(os.path.abspath(__file__))
COUNTRIES_JS = os.path.join(HERE, '..', 'site', 'countries.js')
NEAR = 0.5  # degrees: countries closer than this count as neighbours (covers narrow straits and island chains)

# Names on the globe (Natural Earth) that GeoNames spells differently, or that are not countries: the ISO code whose currency they use.
NAME_TO_ISO = {
    "People's Republic of China": 'CN',
    'Czech Republic': 'CZ',
    'East Timor': 'TL',
    'Cape Verde': 'CV',
    'Palestine': 'PS',
    'Vatican City': 'VA',
    'Macau': 'MO',
    'Federated States of Micronesia': 'FM',
    'United States of America': 'US',
    'United States Virgin Islands': 'VI',
    'Pitcairn Islands': 'PN',
    'Åland': 'AX',
    'French Southern and Antarctic Lands': 'TF',
    'Australian Indian Ocean Territories': 'CX',  # Christmas Island and the Cocos (Keeling) Islands both use the Australian dollar
    # Bases and islands with no ISO code of their own: the country that runs them.
    'Dhekelia Cantonment': 'CY',  # British bases on Cyprus use the euro
    'Akrotiri Sovereign Base Area': 'CY',
    'Guantanamo Bay Naval Base': 'US',
    'Wake Island': 'US',
    'Brazilian Island': 'BR',
    'Clipperton Island': 'FR',
    'Ashmore and Cartier Islands': 'AU',
}

# Where GeoNames is out of date (checked against the central banks / official announcements).
CURRENCY_FIX = {
    'BG': 'EUR',  # Bulgaria joined the euro area on 1 January 2026
}

# Names the page shows differently from CLDR's English name.
NAME_FIX = {
    'XCG': 'Caribbean Guilder',  # CLDR writes it in lower case
    'ZWG': 'Zimbabwe Gold (ZiG)',
}

# Symbols the English locale in CLDR does not have (it only has the code), taken from the currencies' own countries.
SYMBOL_FIX = {
    'UAH': '₴', 'RUB': '₽', 'TRY': '₺', 'KZT': '₸', 'GEL': '₾', 'AZN': '₼', 'NGN': '₦', 'THB': '฿', 'BDT': '৳', 'LAK': '₭', 'MNT': '₮',
    'PYG': '₲', 'CRC': '₡', 'GHS': '₵', 'PLN': 'zł', 'CZK': 'Kč', 'HUF': 'Ft', 'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr', 'ISK': 'kr',
    'ZAR': 'R', 'PKR': 'Rs', 'LKR': 'Rs', 'NPR': 'Rs', 'IDR': 'Rp', 'MYR': 'RM',
}  # fmt: skip

# A second currency that is widely accepted next to the official one (a short, deliberately small list).
ALSO = {
    'Panama': 'USD',
    'Cambodia': 'USD',
    'Zimbabwe': 'USD',
    'Liberia': 'USD',
    'Bhutan': 'INR',
    'Lesotho': 'ZAR',
    'Namibia': 'ZAR',
    'Eswatini': 'ZAR',
}


def plain(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return s[4:] if s.startswith('the ') else s


def load_countries():
    text = open(COUNTRIES_JS, encoding='utf-8').read()
    data = json.loads(text[text.index('{') : text.rindex('}') + 1])
    return [(f['properties']['n'], shape(f['geometry']).buffer(0)) for f in data['features']]


def country_currency(countries):
    """{name on the globe: currency code}"""
    gc = geonamescache.GeonamesCache().get_countries()
    by_name = {plain(c['name']): iso for iso, c in gc.items()}
    out, missing = {}, []
    for name, _ in countries:
        iso = NAME_TO_ISO.get(name) or by_name.get(plain(name))
        if iso is None or iso not in gc:
            missing.append(name)
            continue
        code = CURRENCY_FIX.get(iso, gc[iso]['currencycode'])
        if code:
            out[name] = code
    if missing:
        sys.exit('No country found for: ' + ', '.join(missing))
    return out, gc


def currency_info(codes, gc):
    family = {}
    for c in gc.values():
        if c['currencycode']:
            family.setdefault(c['currencycode'], c['currencyname'])
    info = {}
    for code in sorted(codes):
        name = NAME_FIX.get(code) or get_currency_name(code, locale='en')
        sym = SYMBOL_FIX.get(code) or get_currency_symbol(code, locale='en')
        info[code] = [name, '' if sym == code else sym, family.get(code, ''), -1]
    return info


def neighbours(countries, cur):
    """{code: set of other codes whose countries lie within NEAR degrees}"""
    geoms = [g for _, g in countries]
    tree = STRtree(geoms)
    near = {c: set() for c in set(cur.values())}
    for i, (name, g) in enumerate(countries):
        if name not in cur:
            continue
        for j in tree.query(g.buffer(NEAR)):
            other = countries[j][0]
            if other != name and other in cur and cur[other] != cur[name]:
                near[cur[name]].add(cur[other])
                near[cur[other]].add(cur[name])
    return near


def colour(near, size):
    """DSATUR: always colour next the currency whose neighbours already use the most different slots; lowest free slot wins.
    Ties go to the currency with the most countries, so the biggest ones get the slots that are easiest to tell apart."""
    slot = {}
    todo = set(near)
    while todo:
        c = max(todo, key=lambda c: (len({slot[n] for n in near[c] if n in slot}), size[c], c))
        used = {slot[n] for n in near[c] if n in slot}
        slot[c] = next(i for i in range(len(near) + 1) if i not in used)
        todo.discard(c)
    return slot


def main():
    countries = load_countries()
    cur, gc = country_currency(countries)
    codes = set(cur.values()) | set(ALSO.values())
    info = currency_info(codes, gc)
    size = {c: list(cur.values()).count(c) for c in set(cur.values())}
    slot = colour(neighbours(countries, cur), size)
    for code, s in slot.items():
        info[code][3] = s
    for code in codes - set(cur.values()):
        info[code][3] = 0  # only "also accepted" somewhere, never drawn on the map
    for name in ALSO:
        assert name in cur, name
    dump = lambda v: json.dumps(v, separators=(',', ':'), ensure_ascii=False)
    used = sorted(set(cur.values()))
    text = (
        '{"v":1,"c":{\n'
        + ',\n'.join(f'{dump(c)}:{dump(info[c])}' for c in sorted(info))
        + '\n},"m":{\n'
        + ',\n'.join(f'{dump(n)}:{dump(cur[n])}' for n in sorted(cur))
        + '\n},"a":'
        + dump(ALSO)
        + '}\n'
    )
    print(len(cur), 'countries,', len(used), 'currencies,', max(slot.values()) + 1, 'colour slots,', len(text) // 1024, 'KiB')
    if '--check' in sys.argv:
        return
    print('->', publish('currencies.json', text))


if __name__ == '__main__':
    main()
