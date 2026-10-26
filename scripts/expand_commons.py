"""Bounded, cached Commons expansion: NYC neighborhoods, night/dawn, categories and GPS.
No image originals are downloaded. Eligibility is provisional metadata qualification.
"""
from collections import Counter
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request
try:
    from .metadata_rules import boundaries,clean,coordinate,locate,parse_capture,RELEVANCE,NONPHOTO
    from .enrich_locations import write_json
except ImportError:
    from metadata_rules import boundaries,clean,coordinate,locate,parse_capture,RELEVANCE,NONPHOTO
    from enrich_locations import write_json
ROOT=Path(__file__).resolve().parents[1]
API='https://commons.wikimedia.org/w/api.php'
UA='PhotoClock/1.0 (https://amandayehh.github.io/photo-clock/; bounded metadata research)'
BOROUGHS=['Manhattan','Brooklyn','Queens New York','Bronx','Staten Island']
NEIGHBORHOODS=['Harlem','Chinatown Manhattan','Lower East Side','Washington Heights','East Village',
 'DUMBO Brooklyn','Williamsburg Brooklyn','Bushwick Brooklyn','Coney Island','Greenpoint Brooklyn',
 'Long Island City','Astoria Queens','Flushing Queens','Rockaway Queens','Jackson Heights',
 'City Island Bronx','Fordham Bronx','Riverdale Bronx','St George Staten Island','Tottenville Staten Island']
CATEGORIES=['New York City at night','Manhattan at night','Brooklyn at night','Times Square at night',
 'Sunrises in New York City','Coney Island','Staten Island Ferry','Flushing Meadows-Corona Park',
 'City Island, Bronx','Photographs of New York City']
POINTS=[(40.8075,-73.945),(40.868,-73.922),(40.714,-73.998),(40.722,-73.981),
 (40.715,-73.96),(40.695,-73.92),(40.67,-73.963),(40.583,-73.984),
 (40.758,-73.831),(40.769,-73.921),(40.75,-73.884),(40.578,-73.84),
 (40.85,-73.882),(40.847,-73.788),(40.885,-73.91),(40.817,-73.921),
 (40.51,-74.252),(40.586,-74.077),(40.629,-74.105),(40.56,-74.135)]

class Client:
    def __init__(self):
        self.cache=ROOT/'.cache/commons-expanded';self.cache.mkdir(parents=True,exist_ok=True)
        self.last=0;self.failures=[];self.calls=0
    def call(self,**params):
        params={'action':'query','format':'json','formatversion':2,'maxlag':5,**params}
        key=hashlib.sha256(json.dumps(params,sort_keys=True).encode()).hexdigest()
        path=self.cache/(key+'.json')
        if path.exists():return json.loads(path.read_text())
        url=API+'?'+urllib.parse.urlencode(params)
        for attempt in range(3):
            time.sleep(max(0,.6-(time.monotonic()-self.last)));self.last=time.monotonic();self.calls+=1
            try:
                with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=55) as response:
                    result=json.load(response)
                if result.get('error'):
                    if result['error'].get('code')=='maxlag':time.sleep(5);continue
                    raise ValueError(result['error'].get('code'))
                write_json(path,result);return result
            except urllib.error.HTTPError as error:
                if error.code==429:
                    raise RuntimeError('Commons rate limit reached; rerun later to resume cached progress.') from None
                reason=f'HTTP {error.code}'
            except (urllib.error.URLError,TimeoutError,ValueError) as error:reason=type(error).__name__
            time.sleep(2**attempt)
        self.failures.append({'params':params,'reason':reason if 'reason' in locals() else 'maxlag'})
        return {}


def normalize(page,routes,polygons,checked,excluded):
    info=(page.get('imageinfo') or [{}])[0]
    meta={x['name']:x['value'] for x in info.get('metadata',[]) if isinstance(x,dict) and 'name' in x}
    ext={k:clean(v.get('value')) for k,v in info.get('extmetadata',{}).items()}
    title=page.get('title','');capture=parse_capture(meta.get('DateTimeOriginal'),meta.get('OffsetTimeOriginal'))
    reasons=[]
    if str(page.get('pageid')) in excluded:reasons.append('previous_manual_exclusion')
    if info.get('mime') not in ('image/jpeg','image/png','image/webp','image/tiff'):reasons.append('unsupported_media')
    if not capture:reasons.append('missing_camera_capture_time')
    if not (meta.get('Make') or meta.get('Model')) or not any(meta.get(k) for k in ('ExposureTime','FNumber','FocalLength')):reasons.append('insufficient_camera_evidence')
    if NONPHOTO.search(title):reasons.append('nonphoto_title')
    description=ext.get('ImageDescription','')
    if re.search(r'\b(?:[a-z]+|\d+)[ -]segment panorama\b|\bstitched\b|\bcomposite photograph\b',description,re.I):reasons.append('multi_exposure_composite')
    if min(info.get('width',0),info.get('height',0))<480:reasons.append('short_edge_under_480px')
    license_name=ext.get('LicenseShortName','');license_url=ext.get('LicenseUrl','')
    if not (re.match(r'^CC BY(?:-SA)? [\d.]+$',license_name) or license_name in ('CC0','Public domain')):reasons.append('license_needs_review')
    if not ext.get('Artist'):reasons.append('missing_artist')
    raw_lat=coordinate(meta.get('GPSLatitude'),meta.get('GPSLatitudeRef'));raw_lon=coordinate(meta.get('GPSLongitude'),meta.get('GPSLongitudeRef'))
    lat=coordinate(ext.get('GPSLatitude'));lon=coordinate(ext.get('GPSLongitude'))
    raw_borough=locate(raw_lat,raw_lon,polygons);template_borough=locate(lat,lon,polygons)
    text=RELEVANCE.search(title+' '+description+' '+ext.get('Categories',''))
    relevance='camera_gps_in_nyc' if raw_borough else 'commons_location_in_nyc' if template_borough else 'nyc_text_evidence' if text else None
    if not relevance:reasons.append('nyc_relevance_not_established')
    if raw_lat is not None and raw_lon is not None and lat is not None and lon is not None and (abs(raw_lat-lat)>.01 or abs(raw_lon-lon)>.01):reasons.append('conflicting_camera_coordinates')
    if capture:
        given=re.search(r'\b(\d{4}-\d{2}-\d{2})\b',ext.get('DateTimeOriginal',''))
        if given:
            try:
                if abs((dt.date.fromisoformat(given[1])-dt.date.fromisoformat(capture['capture_date'])).days)>1:reasons.append('conflicting_capture_date')
            except ValueError:pass
        if capture['timezone_status']=='assumed_local' and re.search(r'\b(ISS|International Space Station|in.flight|from an airplane|from an aircraft)\b',title+' '+description,re.I):reasons.append('unresolved_airborne_timezone')
    if not info.get('thumburl') or not info.get('descriptionurl'):reasons.append('missing_image_url')
    if reasons:return None,reasons
    # Prefer Commons Camera location for the address, as in the existing app.
    if lat is None or lon is None:lat,lon=raw_lat,raw_lon
    camera={'latitude':lat,'longitude':lon,'source':'Wikimedia Commons Camera location','checked_at':checked} if lat is not None and lon is not None and -90<=lat<=90 and -180<=lon<=180 and (lat or lon) else None
    credit_html=info.get('extmetadata',{}).get('Credit',{}).get('value','')
    flickr_ids=sorted(set(re.findall(r'flickr\.com/photos/[^/\s\"<>]+/(\d+)',credit_html)))
    return {'pageid':page['pageid'],'source':'commons','title':title,**capture,
      'capture_original':meta['DateTimeOriginal'],'offset_original':meta.get('OffsetTimeOriginal'),
      'relevance':relevance,'borough':raw_borough or template_borough,'camera_location':camera,
      'width':info['width'],'height':info['height'],'sha1':info.get('sha1'),
      'artist':ext['Artist'],'credit':ext.get('Credit',''),'attribution':ext.get('Attribution',''),
      'license':license_name,'license_url':license_url,'source_url':info['descriptionurl'],
      'thumbnail_url':info['thumburl'],'image_url':info.get('url',''),'description':description,
      'camera_model':meta.get('Model',''),'flickr_origin_ids':flickr_ids,
      'discovery_routes':sorted(set(r['method'] for r in routes)),'discovery_details':routes,
      'source_checked_at':checked},[]


def main():
    client=Client();path=ROOT/'dist/photos.json';data=json.loads(path.read_text())
    baseline=data.setdefault('expansion_baseline',{'photos':len(data['photos']),'minutes':sorted({p['minute'] for p in data['photos']}),'pageids':[p['pageid'] for p in data['photos']]})
    existing={p['pageid']:p for p in data['photos']};sha_seen={p['sha1'] for p in data['photos'] if p.get('sha1')}
    excluded=json.loads((ROOT/'scripts/data/review-exclusions.json').read_text())
    candidates={};discovery=[]
    def add(items,method,label):
        for item in items:
            if not item.get('pageid') or item['pageid'] in existing:continue
            p=candidates.setdefault(item['pageid'],{'title':item['title'],'routes':[]})
            p['routes'].append({'method':method,'label':label})
        discovery.append({'method':method,'label':label,'results':len(items)})
    queries=[f'{borough} {light} filetype:bitmap' for light in ('night','dawn','early morning','sunrise') for borough in BOROUGHS]
    queries += [f'{name} New York filetype:bitmap' for name in NEIGHBORHOODS]
    for i,query in enumerate(queries,1):
        r=client.call(list='search',srsearch=query,srnamespace=6,srlimit=100,srprop='')
        add(r.get('query',{}).get('search',[]),'expanded-text',query)
        print(f'Text {i}/{len(queries)}; {len(candidates)} new candidates',flush=True)
    for name in CATEGORIES:
        r=client.call(list='categorymembers',cmtitle='Category:'+name,cmtype='file',cmlimit=100)
        add(r.get('query',{}).get('categorymembers',[]),'expanded-category',name)
    for lat,lon in POINTS:
        r=client.call(list='geosearch',gscoord=f'{lat}|{lon}',gsradius=1500,gsnamespace=6,gslimit=100,gsprimary='all')
        add(r.get('query',{}).get('geosearch',[]),'expanded-geo',f'{lat},{lon}; 1500m')
    print(f'Discovered {len(candidates)} new candidates; loading camera metadata',flush=True)
    ids=list(candidates);timed=[];rejected=Counter();audit=[]
    for start in range(0,len(ids),40):
        batch=ids[start:start+40]
        r=client.call(pageids='|'.join(map(str,batch)),prop='imageinfo',iiprop='metadata|url|size|mime|sha1',iimetadataversion='latest',iiurlwidth=960)
        returned=set()
        for page in r.get('query',{}).get('pages',[]):
            pid=page.get('pageid');returned.add(pid)
            if pid not in candidates:continue
            candidates[pid]['page']=page
            meta={x.get('name'):x.get('value') for x in (page.get('imageinfo') or [{}])[0].get('metadata',[])}
            if parse_capture(meta.get('DateTimeOriginal'),meta.get('OffsetTimeOriginal')):timed.append(pid)
            else:rejected['missing_camera_capture_time']+=1
        rejected['metadata_request_incomplete']+=len(set(batch)-returned)
        if start%200==0:print(f'Camera metadata {min(start+40,len(ids))}/{len(ids)}; {len(timed)} timed',flush=True)
    polygons=boundaries();checked=dt.datetime.now(dt.timezone.utc).isoformat();added=[]
    for start in range(0,len(timed),15):
        batch=timed[start:start+15]
        r=client.call(pageids='|'.join(map(str,batch)),prop='imageinfo',iiprop='extmetadata',iiextmetadatalanguage='en',iiextmetadatafilter='ImageDescription|Artist|Credit|DateTimeOriginal|GPSLatitude|GPSLongitude|Categories|LicenseShortName|LicenseUrl|Attribution|Restrictions')
        pages={p['pageid']:p for p in r.get('query',{}).get('pages',[]) if 'pageid' in p}
        for pid in batch:
            c=candidates[pid];page=c['page'];info=page['imageinfo'][0]
            info['extmetadata']=(pages.get(pid,{}).get('imageinfo') or [{}])[0].get('extmetadata',{})
            record,reasons=normalize(page,c['routes'],polygons,checked,excluded)
            if record and record.get('sha1') in sha_seen:record=None;reasons=['duplicate_image_content']
            if record:
                added.append(record)
                if record.get('sha1'):sha_seen.add(record['sha1'])
            else:rejected.update(reasons)
            audit.append({'pageid':pid,'title':page['title'],'accepted':bool(record),'reasons':reasons})
        if start%75==0:print(f'License/relevance {min(start+15,len(timed))}/{len(timed)}; {len(added)} accepted',flush=True)
    data['photos']+=added;data['updated']=checked[:10]
    data['commons_expansion']={'checked_at':checked,'candidates':len(ids),'added':len(added),'total_photos':len(data['photos']),
       'covered_minutes':len({p['minute'] for p in data['photos']}),'new_minutes':len({p['minute'] for p in data['photos']}-set(baseline['minutes'])),
       'rejections':dict(rejected),'requests':client.calls,'request_failures':client.failures,'discovery':discovery,'bounded_sample':True}
    write_json(ROOT/'.cache/commons-expanded/audit.json',audit)
    write_json(path,data)
    print(json.dumps({k:v for k,v in data['commons_expansion'].items() if k not in ('discovery','request_failures')},indent=2),flush=True)

if __name__=='__main__':main()
