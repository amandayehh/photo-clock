"""Camera-time and NYC relevance rules shared with the original Commons study."""
import datetime as dt
import html
import json
import math
import pathlib
import re
from zoneinfo import ZoneInfo
ROOT = pathlib.Path(__file__).resolve().parent
NY = ZoneInfo('America/New_York')

def clean(value):
    return html.unescape(re.sub('<[^>]*>', '', str(value or ''))).strip()

def parse_capture(value, offset=None):
    if not isinstance(value,str):
        return None
    match = re.fullmatch(r'\s*(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?\s*',value)
    if not match:
        return None
    y,mo,d,h,mi,s = [int(x or 0) for x in match.groups()[:6]]
    try:
        captured = dt.datetime(y,mo,d,h,mi,s)
        zone = match.group(7) or (offset.strip() if isinstance(offset,str) else None)
        status = 'assumed_local'
        if zone:
            if zone == 'Z':
                delta = 0
            elif re.fullmatch(r'[+-]\d{2}:?\d{2}',zone):
                digits = zone[1:].replace(':','')
                hh, mm = int(digits[:2]), int(digits[2:])
                if hh > 14 or mm > 59 or (hh == 14 and mm):
                    return None
                delta = (hh*60+mm) * (-1 if zone[0]=='-' else 1)
            else:
                return None
            captured = captured.replace(tzinfo=dt.timezone(dt.timedelta(minutes=delta))).astimezone(NY)
            status = 'explicit_offset'
        return {'capture_date':captured.date().isoformat(),'minute':captured.hour*60+captured.minute,
                'capture_local':captured.isoformat(),'timezone_status':status}
    except (ValueError,OverflowError):
        return None

def coordinate(value, ref=None):
    try:
        if isinstance(value,list):
            nums = [v['value'] for v in value if isinstance(v,dict) and str(v.get('name','')).isdigit()]
            def fraction(n):
                if isinstance(n,str) and '/' in n:
                    a,b = n.split('/')
                    return float(a)/float(b)
                return float(n)
            numbers = [fraction(n) for n in nums]
            if len(numbers) < 3:
                return None
            number = numbers[0]+numbers[1]/60+numbers[2]/3600
        else:
            number = float(value)
        if str(ref).upper() in ('S','W'):
            number = -abs(number)
        return number if math.isfinite(number) else None
    except (ValueError,TypeError,ZeroDivisionError):
        return None

def in_ring(x,y,ring):
    inside = False
    x1,y1 = ring[-1][:2]
    for point in ring:
        x2,y2 = point[:2]
        if (y1>y) != (y2>y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1:
            inside = not inside
        x1,y1 = x2,y2
    return inside

def boundaries():
    data = json.loads((ROOT/'data/boroughs.geojson').read_text())
    polygons = []
    for feature in data['features']:
        geometry = feature['geometry']
        multi = geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
        for rings in multi:
            xs,ys = zip(*[(p[0],p[1]) for p in rings[0]])
            polygons.append((feature['properties']['boroname'],(min(xs),min(ys),max(xs),max(ys)),rings))
    return polygons

def locate(lat,lon,polygons):
    if lat is None or lon is None or not (-90<=lat<=90 and -180<=lon<=180):
        return None
    for borough,(x1,y1,x2,y2),rings in polygons:
        if x1<=lon<=x2 and y1<=lat<=y2 and in_ring(lon,lat,rings[0]) and not any(in_ring(lon,lat,r) for r in rings[1:]):
            return borough
    return None

RELEVANCE = re.compile(r'\b(new york city|nyc|manhattan|brooklyn|the bronx|staten island|queens[, ]+(?:new york|ny)|times square|central park|coney island|grand central terminal|empire state building|world trade center|rockefeller center|flushing meadows|astoria[, ]+(?:queens|new york)|long island city|yankee stadium|bronx zoo|new york[, ]+(?:new york|ny))\b',re.I)
NONPHOTO = re.compile(r'\b(map|maps|drawing|drawings|engraving|engravings|lithograph|lithographs|painting|paintings|postcard|postcards|diagram|diagrams|screenshot|screenshots|coat of arms|logo|logos|flag|flags)\b',re.I)

