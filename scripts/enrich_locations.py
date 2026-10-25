"""Cache Commons camera coordinates and nearby NYC Planning postal addresses."""
import argparse
import datetime
import json
import math
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = 'NewYorkMinuteClock/1.0 (https://new-york-minute-clock.elicit-9422.chatgpt.site)'
COMMONS = 'https://commons.wikimedia.org/w/api.php'
GEOCODER = 'https://geosearch.planninglabs.nyc/v2/reverse'
MAX_DISTANCE_METERS = 150


def request_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def camera_coordinates(metadata):
    try:
        lat = float(metadata['GPSLatitude']['value'])
        lon = float(metadata['GPSLongitude']['value'])
        datum = metadata.get('GPSMapDatum', {}).get('value', 'WGS-84')
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
            return None
        if datum.upper().replace('-', '').replace(' ', '') not in ('WGS84', ''):
            return None
        return {'latitude': lat, 'longitude': lon}
    except (KeyError, TypeError, ValueError):
        return None


def distance_m(lat, lon, other_lat, other_lon):
    a, b = math.radians(lat), math.radians(other_lat)
    h = math.sin((b-a)/2)**2 + math.cos(a)*math.cos(b)*math.sin(math.radians(other_lon-lon)/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def address_from_result(result, camera):
    for feature in result.get('features', []):
        p = feature.get('properties', {})
        coordinates = feature.get('geometry', {}).get('coordinates', [])
        if len(coordinates) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in coordinates):
            continue
        distance = distance_m(camera['latitude'], camera['longitude'], coordinates[1], coordinates[0])
        street = ' '.join(str(p.get(k) or '').strip() for k in ('housenumber', 'street')).strip()
        city, zipcode = str(p.get('locality') or '').strip(), str(p.get('postalcode') or '').strip()
        if distance > MAX_DISTANCE_METERS or not p.get('street') or not city or not re.fullmatch(r'\d{5}(?:-\d{4})?', zipcode):
            continue
        return {'street': street, 'city': city, 'region': p.get('region_a', ''),
                'postal_code': zipcode, 'distance_m': round(distance, 1),
                'provider': 'NYC Planning GeoSearch', 'approximate': True}
    return None


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    options = {'separators': (',', ':')} if path.name == 'photos.json' else {'indent': 2}
    temporary.write_text(json.dumps(data, ensure_ascii=False, **options) + '\n')
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true', help='Re-fetch camera coordinates; reuse address cache.')
    args = parser.parse_args()
    dataset_path, cache_path = ROOT/'dist/photos.json', ROOT/'.cache/camera-addresses.json'
    data = json.loads(dataset_path.read_text())
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    checked_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    pending = [p for p in data['photos'] if args.refresh or 'camera_location' not in p]
    for offset in range(0, len(pending), 50):
        batch = pending[offset:offset+50]
        query = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'imageinfo',
            'pageids': '|'.join(str(p['pageid']) for p in batch), 'iiprop': 'extmetadata',
            'iiextmetadatafilter': 'GPSLatitude|GPSLongitude|GPSMapDatum', 'maxlag': 5})
        response = request_json(COMMONS + '?' + query)
        if 'error' in response:
            raise RuntimeError(response['error'])
        pages = response['query']['pages']
        for photo in batch:
            page = pages.get(str(photo['pageid']), {})
            info = (page.get('imageinfo') or [{}])[0]
            camera = camera_coordinates(info.get('extmetadata', {}))
            if camera:
                camera.update({'source': 'Wikimedia Commons Camera location', 'checked_at': checked_at})
            photo['camera_location'] = camera
            photo.pop('location_address', None)
        write_json(dataset_path, data)
        print(f'Camera metadata: {min(offset+50, len(pending))}/{len(pending)}', flush=True)
        time.sleep(.6)
    failures = 0
    for number, photo in enumerate(data['photos'], 1):
        camera = photo.get('camera_location')
        if not camera:
            photo['location_address'] = None
            continue
        if not args.refresh and 'location_address' in photo:
            continue
        key = f"{camera['latitude']:.6f},{camera['longitude']:.6f}"
        if key not in cache:
            query = urllib.parse.urlencode({'point.lat': camera['latitude'], 'point.lon': camera['longitude'], 'size': 1})
            url = GEOCODER + '?' + query
            try:
                result = request_json(url)
                if result.get('geocoding', {}).get('errors'):
                    raise RuntimeError(result['geocoding']['errors'])
                address = address_from_result(result, camera)
                if address:
                    address.update({'lookup_url': url, 'checked_at': checked_at})
                cache[key] = address
                write_json(cache_path, cache)
            except Exception as error:
                failures += 1
                print(f'Lookup failed for {photo["pageid"]}: {error}', flush=True)
                if failures >= 3:
                    raise RuntimeError('Stopping after three lookup failures; rerun to resume.')
                continue
            finally:
                time.sleep(.6)
        photo['location_address'] = cache[key]
        write_json(dataset_path, data)
        if number % 25 == 0:
            print(f'Address progress: {number}/{len(data["photos"])}', flush=True)
    data['location_updated'] = checked_at
    write_json(dataset_path, data)
    print(json.dumps({'photos': len(data['photos']),
        'camera_coordinates': sum(bool(p.get('camera_location')) for p in data['photos']),
        'addresses': sum(bool(p.get('location_address')) for p in data['photos']), 'failures': failures}), flush=True)


if __name__ == '__main__':
    main()
