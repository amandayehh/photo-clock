"""Monthly Commons maintenance. Publish only after a complete, successful check."""
import argparse
from collections import Counter
from copy import deepcopy
import datetime as dt
import json
import os
from pathlib import Path

try:
    from .expand_commons import Client, ROOT, BOROUGHS, NEIGHBORHOODS, CATEGORIES, POINTS, normalize
    from .metadata_rules import boundaries
    from .enrich_locations import write_json
except ImportError:
    from expand_commons import Client, ROOT, BOROUGHS, NEIGHBORHOODS, CATEGORIES, POINTS, normalize
    from metadata_rules import boundaries
    from enrich_locations import write_json

MAX_NEW_CANDIDATES = 1000
EXT_FIELDS = 'ImageDescription|Artist|Credit|DateTimeOriginal|GPSLatitude|GPSLongitude|Categories|LicenseShortName|LicenseUrl|Attribution|Restrictions'


def discover(client, existing, smoke=False):
    candidates = {}
    searches = [(f'{place} New York filetype:bitmap', 'recent-text') for place in BOROUGHS + NEIGHBORHOODS]
    searches += [(f'{place} {light} filetype:bitmap', 'recent-text') for light in ('night', 'dawn', 'sunrise') for place in BOROUGHS]

    def add(items, method, label):
        for item in items:
            pid = item.get('pageid')
            if not pid or pid in existing:
                continue
            if pid not in candidates and len(candidates) >= MAX_NEW_CANDIDATES:
                continue
            candidate = candidates.setdefault(pid, {'title': item['title'], 'routes': []})
            candidate['routes'].append({'method': method, 'label': label})

    for query, method in searches[:1] if smoke else searches:
        result = client.call(list='search', srsearch=query, srnamespace=6,
                             srlimit=5 if smoke else 100, srprop='', srsort='create_timestamp_desc')
        add(result['query']['search'], method, query)
    if not smoke:
        for category in CATEGORIES:
            result = client.call(list='categorymembers', cmtitle='Category:' + category,
                                 cmtype='file', cmlimit=100, cmsort='timestamp', cmdir='desc')
            add(result['query']['categorymembers'], 'recent-category', category)
        for lat, lon in POINTS:
            result = client.call(list='geosearch', gscoord=f'{lat}|{lon}', gsradius=1500,
                                 gsnamespace=6, gslimit=100, gsprimary='all')
            add(result['query']['geosearch'], 'monthly-geo', f'{lat},{lon}; 1500m')
    return candidates


def fetch_pages(client, ids):
    pages = {}
    # Small batches avoid Commons' expensive-property limits for extmetadata.
    for offset in range(0, len(ids), 10):
        batch = ids[offset:offset + 10]
        result = client.call(pageids='|'.join(map(str, batch)), prop='imageinfo',
                             iiprop='metadata|extmetadata|url|size|mime|sha1',
                             iimetadataversion='latest', iiurlwidth=960,
                             iiextmetadatalanguage='en', iiextmetadatafilter=EXT_FIELDS)
        returned = {p['pageid']: p for p in result.get('query', {}).get('pages', []) if 'pageid' in p}
        if set(batch) - returned.keys():
            raise RuntimeError('Incomplete Commons response; collection has not been changed.')
        for page in returned.values():
            if not page.get('missing') and not (page.get('imageinfo') or [{}])[0].get('extmetadata'):
                raise RuntimeError('Incomplete image metadata; collection has not been changed.')
        pages.update(returned)
        print(f'Checked metadata: {min(offset + 10, len(ids))}/{len(ids)}', flush=True)
    return pages


def coordinate_key(photo):
    camera = photo.get('camera_location')
    return (round(camera['latitude'], 6), round(camera['longitude'], 6)) if camera else None


def reconcile(data, candidates, pages, polygons, excluded, checked):
    """Pure reconciliation: errors never mutate the input dataset."""
    result = deepcopy(data)
    existing = {p['pageid']: p for p in data['photos']}
    kept, removed, hashes = [], [], set()
    added = updated = 0
    rejections = Counter()
    for pid in list(existing) + [pid for pid in candidates if pid not in existing]:
        old = existing.get(pid)
        page = pages[pid]
        routes = (old.get('discovery_details') or [{'method': r, 'label': 'Original discovery'} for r in old.get('discovery_routes', [])]) if old else candidates[pid]['routes']
        if page.get('missing'):
            photo, reasons = None, ['deleted_on_commons']
        else:
            photo, reasons = normalize(page, routes, polygons, checked, excluded)
        if photo and photo.get('sha1') in hashes:
            photo, reasons = None, ['duplicate_image_content']
        if not photo:
            rejections.update(reasons)
            if old:
                removed.append({'pageid': pid, 'title': old['title'], 'removed_at': checked, 'reasons': reasons})
            continue
        if photo.get('sha1'):
            hashes.add(photo['sha1'])
        if old:
            # An old reverse-geocoded address is only valid at the same coordinates.
            if coordinate_key(old) is not None and coordinate_key(old) == coordinate_key(photo) and old.get('location_address'):
                photo['location_address'] = old['location_address']
            # Count substantive changes separately from the verification timestamp.
            fields = ('title', 'minute', 'capture_date', 'artist', 'credit', 'license', 'license_url', 'description', 'sha1')
            updated += any(old.get(k) != photo.get(k) for k in fields) or coordinate_key(old) != coordinate_key(photo)
        else:
            added += 1
        kept.append(photo)
    if not kept or len(removed) > max(10, len(existing) * .1):
        raise RuntimeError('Unusually large removal count; review needed before changing the live collection.')
    # Retain the historical baseline and an audit trail for any retired baseline files.
    retired = {p['pageid']: p for p in data.get('retired_photos', [])}
    retired.update({p['pageid']: p for p in removed})
    for photo in kept:
        retired.pop(photo['pageid'], None)
    result['retired_photos'] = list(retired.values())
    result['photos'] = kept
    result['updated'] = checked[:10]
    before = {p['minute'] for p in data['photos']}
    after = {p['minute'] for p in kept}
    result['monthly_check'] = {
        'checked_at': checked, 'existing_checked': len(existing), 'candidates_checked': len(candidates),
        'added': added, 'updated': updated, 'removed': len(removed), 'total_photos': len(kept),
        'covered_minutes': len(after), 'new_minutes': len(after - before), 'lost_minutes': len(before - after),
        'rejections': dict(rejections), 'bounded_sample': True,
    }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--smoke', action='store_true', help='Check ten saved files and a small discovery sample without writing or publishing.')
    args = parser.parse_args()
    path = ROOT / 'dist/photos.json'
    data = json.loads(path.read_text())
    if args.smoke:
        data['photos'] = data['photos'][:10]
    # No response cache is read: both discovery and metadata are fresh each month.
    client = Client(use_cache=False, strict=True)
    existing = {p['pageid'] for p in data['photos']}
    candidates = discover(client, existing, args.smoke)
    ids = [p['pageid'] for p in data['photos']] + list(candidates)
    print(f'Checking {len(existing)} existing files and {len(candidates)} candidates', flush=True)
    pages = fetch_pages(client, ids)
    checked = dt.datetime.now(dt.timezone.utc).isoformat()
    excluded = json.loads((ROOT / 'scripts/data/review-exclusions.json').read_text())
    result = reconcile(data, candidates, pages, boundaries(), excluded, checked)
    print(json.dumps(result['monthly_check'], indent=2), flush=True)
    if args.smoke:
        print('Smoke check succeeded; no catalog, commit, or deployment changes.')
        return
    write_json(path, result)
    summary = result['monthly_check']
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with Path(os.environ['GITHUB_STEP_SUMMARY']).open('a') as stream:
            stream.write(f"### Monthly Commons check\n{summary['added']} added · {summary['updated']} updated · {summary['removed']} removed.\n\n{summary['total_photos']} photos cover {summary['covered_minutes']} exact minutes.\n")


if __name__ == '__main__':
    main()
