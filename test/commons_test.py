import json
from pathlib import Path
import unittest
from scripts.expand_commons import normalize
from scripts.metadata_rules import boundaries, parse_capture
from scripts.build_coverage import summarize

class CommonsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.polygons=boundaries()
    def fixture(self):
        values={'DateTimeOriginal':'2020:06:01 01:12:47','Make':'Canon','ExposureTime':'1/60'}
        ext={'Artist':'Example photographer','LicenseShortName':'CC BY-SA 4.0','LicenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
             'GPSLatitude':'40.758','GPSLongitude':'-73.985','ImageDescription':'Times Square, New York City','DateTimeOriginal':'2020-06-01'}
        return {'pageid':999,'title':'File:Times Square.jpg','imageinfo':[{'metadata':[{'name':k,'value':v} for k,v in values.items()],
         'extmetadata':{k:{'value':v} for k,v in ext.items()},'width':1200,'height':800,'mime':'image/jpeg','sha1':'example',
         'thumburl':'https://example.org/thumb.jpg','url':'https://example.org/image.jpg','descriptionurl':'https://commons.wikimedia.org/wiki/File:Times_Square.jpg'}]}
    def check(self,page,excluded=None):return normalize(page,[{'method':'expanded-geo','label':'test'}],self.polygons,'2026-10-26',excluded or {})
    def test_eligible_camera_time_and_nyc_location(self):
        p,reason=self.check(self.fixture());self.assertEqual(reason,[])
        self.assertEqual(p['minute'],72);self.assertEqual(p['borough'],'Manhattan')
        self.assertEqual(p['capture_date'],'2020-06-01');self.assertEqual(p['source'],'commons')
    def test_missing_camera_time_and_upload_time_are_rejected(self):
        page=self.fixture();page['imageinfo'][0]['metadata']=[{'name':'DateTime','value':'2020:06:01 01:12:47'}]
        p,reason=self.check(page);self.assertIsNone(p);self.assertIn('missing_camera_capture_time',reason)
    def test_license_conflicts_and_prior_exclusions(self):
        page=self.fixture();page['imageinfo'][0]['extmetadata']['LicenseShortName']['value']='CC BY-NC 4.0'
        self.assertIn('license_needs_review',self.check(page)[1])
        self.assertIn('previous_manual_exclusion',self.check(self.fixture(),{'999':{}})[1])
        page=self.fixture();page['imageinfo'][0]['extmetadata']['DateTimeOriginal']['value']='2021-01-01'
        self.assertIn('conflicting_capture_date',self.check(page)[1])
    def test_outside_nyc_without_text_is_not_enough(self):
        page=self.fixture();page['title']='File:Street.jpg';ext=page['imageinfo'][0]['extmetadata']
        ext['GPSLatitude']['value']='42';ext['GPSLongitude']['value']='-75';ext['ImageDescription']['value']='A street'
        self.assertIn('nyc_relevance_not_established',self.check(page)[1])
    def test_explicit_offset_converts_capture_time_to_new_york(self):
        self.assertEqual(parse_capture('2020:06:01 05:12:47','+00:00')['minute'],72)
    def test_collection_has_unique_files_and_preserves_baseline(self):
        data=json.loads((Path(__file__).resolve().parents[1]/'dist/photos.json').read_text())
        photos=data['photos'];ids=[p['pageid'] for p in photos]
        self.assertEqual(len(ids),len(set(ids)))
        hashes=[p['sha1'] for p in photos if p.get('sha1')]
        self.assertEqual(len(hashes),len(set(hashes)))
        retired={p['pageid'] for p in data.get('retired_photos',[])}
        self.assertFalse(retired.intersection(ids))
        self.assertTrue(set(data.get('expansion_baseline',{}).get('pageids',[])).issubset(set(ids)|retired))
        for p in photos:
            self.assertTrue(p['source_url'].startswith('https://commons.wikimedia.org/'))
            self.assertTrue(p['thumbnail_url'].startswith('https://'))
            self.assertTrue(0<=p['minute']<1440)

    def test_coverage_counts_exact_minutes_without_duplicate_ids(self):
        photos=[{'pageid':1,'minute':72},{'pageid':1,'minute':72},{'pageid':2,'minute':73}]
        buckets,stats=summarize(photos)
        self.assertEqual(stats['covered_minutes'],2);self.assertEqual(stats['photos'],2)
        self.assertEqual(buckets[72]['commons'],1);self.assertEqual(stats['missing_minutes'],1438)

if __name__=='__main__':unittest.main()
