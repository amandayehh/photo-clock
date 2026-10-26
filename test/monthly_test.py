from copy import deepcopy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

from scripts.expand_commons import Client, normalize
from scripts.metadata_rules import boundaries
from scripts.refresh_collection import fetch_pages, reconcile
import commons_test


class MonthlyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.polygons = boundaries()

    def fixture(self, pid=999):
        page = commons_test.CommonsTest().fixture()
        page['pageid'] = pid
        page['imageinfo'][0]['sha1'] = str(pid)
        photo, _ = normalize(page, [], self.polygons, '2026-10-01', {})
        return page, photo

    def run_check(self, photos, pages, candidates=None):
        data = {'photos': photos, 'expansion_baseline': {'pageids': [p['pageid'] for p in photos]}}
        original = deepcopy(data)
        result = reconcile(data, candidates or {}, pages, self.polygons, {}, '2026-11-01T14:17:00Z')
        self.assertEqual(data, original)
        return result

    def test_deleted_file_is_retired_and_baseline_stays_historical(self):
        page, photo = self.fixture()
        _, deleted = self.fixture(1000)
        result = self.run_check([photo, deleted], {999: page, 1000: {'pageid': 1000, 'missing': True}})
        self.assertEqual([p['pageid'] for p in result['photos']], [999])
        self.assertEqual(result['retired_photos'][0]['reasons'], ['deleted_on_commons'])
        self.assertEqual(result['expansion_baseline']['pageids'], [999, 1000])

    def test_restricted_license_is_removed(self):
        page, photo = self.fixture()
        bad, old = self.fixture(1000)
        bad['imageinfo'][0]['extmetadata']['LicenseShortName']['value'] = 'CC BY-NC 4.0'
        result = self.run_check([photo, old], {999: page, 1000: bad})
        self.assertEqual(result['monthly_check']['removed'], 1)
        self.assertIn('license_needs_review', result['retired_photos'][0]['reasons'])

    def test_capture_correction_updates_coverage_and_address_is_preserved(self):
        page, photo = self.fixture()
        photo['location_address'] = {'street': 'Example Street'}
        page['imageinfo'][0]['metadata'][0]['value'] = '2020:06:01 02:13:47'
        result = self.run_check([photo], {999: page})
        self.assertEqual(result['photos'][0]['minute'], 133)
        self.assertEqual(result['photos'][0]['location_address'], photo['location_address'])
        self.assertEqual(result['monthly_check']['new_minutes'], 1)
        self.assertEqual(result['monthly_check']['lost_minutes'], 1)
        self.assertEqual(result['monthly_check']['updated'], 1)

    def test_changed_coordinates_remove_stale_address(self):
        page, photo = self.fixture()
        photo['location_address'] = {'street': 'Example Street'}
        page['imageinfo'][0]['extmetadata']['GPSLatitude']['value'] = '40.759'
        result = self.run_check([photo], {999: page})
        self.assertNotIn('location_address', result['photos'][0])

    def test_new_photos_are_added_but_duplicate_content_is_not(self):
        page, photo = self.fixture()
        new, _ = self.fixture(1000)
        duplicate, _ = self.fixture(1001)
        duplicate['imageinfo'][0]['sha1'] = page['imageinfo'][0]['sha1']
        candidates = {pid: {'routes': [{'method': 'recent-text', 'label': 'NYC'}]} for pid in [1000, 1001]}
        result = self.run_check([photo], {999: page, 1000: new, 1001: duplicate}, candidates)
        self.assertEqual(result['monthly_check']['added'], 1)
        self.assertEqual(result['monthly_check']['rejections']['duplicate_image_content'], 1)

    def test_large_removal_aborts_without_mutating_input(self):
        pairs = [self.fixture(i) for i in range(20)]
        data = {'photos': [photo for _, photo in pairs]}
        original = deepcopy(data)
        pages = {i: {'pageid': i, 'missing': True} if i < 11 else pairs[i][0] for i in range(20)}
        with self.assertRaisesRegex(RuntimeError, 'removal'):
            reconcile(data, {}, pages, self.polygons, {}, '2026-11-01')
        self.assertEqual(data, original)

    def test_partial_metadata_response_is_not_a_deletion(self):
        class IncompleteClient:
            def call(self, **params):
                return {'query': {'pages': []}}
        with self.assertRaisesRegex(RuntimeError, 'Incomplete Commons response'):
            fetch_pages(IncompleteClient(), [999])

    def test_fresh_client_ignores_saved_response_and_failure_is_fatal(self):
        with tempfile.TemporaryDirectory() as directory:
            client = Client(use_cache=False, strict=True)
            client.cache = Path(directory)
            response = {'query': {'pages': []}}
            with patch('scripts.expand_commons.time.sleep'), patch('scripts.expand_commons.urllib.request.urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
                self.assertEqual(client.call(pageids='999'), response)
            with patch('scripts.expand_commons.time.sleep'), patch('scripts.expand_commons.urllib.request.urlopen', side_effect=urllib.error.URLError('offline')) as request:
                with self.assertRaisesRegex(RuntimeError, 'Commons request failed'):
                    client.call(pageids='999')
                self.assertEqual(request.call_count, 3)


if __name__ == '__main__':
    unittest.main()
