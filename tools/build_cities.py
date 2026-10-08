#!/usr/bin/env python3
"""Writes site/cities.<hash>.json (see data_files.py): the cities the page's search box knows (population >= 100k, plus every capital).

Source: the geonamescache package (GeoNames).  Run: pip install geonamescache && python3 tools/build_cities.py
Format: {"v":1,"k":{cc: country name},"c":[[name, cc, lat, lon, timezone, population, alt-name?], ...]} sorted by population.
"""
import json, os, unicodedata
import geonamescache
from data_files import publish

MIN_POP = 100_000

# Older or Russian-style spellings people still type.
ALIASES = {'Kyiv': 'Kiev', 'Kharkiv': 'Kharkov', 'Odesa': 'Odessa', 'Lviv': 'Lvov', 'Dnipro': 'Dnepropetrovsk', 'Mumbai': 'Bombay',
           'Kolkata': 'Calcutta', 'Chennai': 'Madras', 'Beijing': 'Peking', 'Ho Chi Minh City': 'Saigon', 'Yangon': 'Rangoon',
           'Istanbul': 'Constantinople', 'Kraków': 'Cracow', 'Gdańsk': 'Danzig', 'Wrocław': 'Breslau', 'Chişinău': 'Kishinev',
           'Minsk': 'Mensk', 'Nur-Sultan': 'Astana', 'Astana': 'Nur-Sultan', 'Bengaluru': 'Bangalore', 'Thiruvananthapuram': 'Trivandrum'}

def ascii_(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()

def main():
    gc = geonamescache.GeonamesCache()
    countries = gc.get_countries()
    caps = {(c['capital'], iso) for iso, c in countries.items() if c['capital']}
    rows = []
    for c in gc.get_cities().values():
        if c['population'] < MIN_POP and (c['name'], c['countrycode']) not in caps:
            continue
        name = c['name']
        alt = ''
        if ascii_(name) != name:                    # keep one plain-ASCII spelling for people without accents on the keyboard
            alt = ascii_(name)
        alt = alt or ALIASES.get(name, '')
        row = [name, c['countrycode'], round(c['latitude'], 3), round(c['longitude'], 3), c['timezone'], c['population']]
        if alt:
            row.append(alt)
        rows.append(row)
    rows.sort(key=lambda r: -r[5])
    used = {r[1] for r in rows}
    k = {iso: countries[iso]['name'] for iso in sorted(used) if iso in countries}
    dump = lambda v: json.dumps(v, separators=(',', ':'), ensure_ascii=False)
    text = '{"v":1,"k":' + dump(k) + ',"c":[\n' + ',\n'.join(dump(r) for r in rows) + '\n]}\n'
    name = publish('cities.json', text)
    print(len(rows), 'cities,', len(text) // 1024, 'KiB ->', name)

if __name__ == '__main__':
    main()
