import unittest
from scripts.enrich_locations import camera_coordinates, address_from_result


class LocationsTest(unittest.TestCase):
    def test_camera_coordinates_only(self):
        self.assertEqual(camera_coordinates({'GPSLatitude': {'value': '40.758'}, 'GPSLongitude': {'value': '-73.985'}}), {'latitude': 40.758, 'longitude': -73.985})
        for metadata in [{}, {'ObjectGPSLatitude': {'value': 40.75}, 'ObjectGPSLongitude': {'value': -73.98}}, {'GPSLatitude': {'value': 'NaN'}, 'GPSLongitude': {'value': -73}}, {'GPSLatitude': {'value': 0}, 'GPSLongitude': {'value': 0}}, {'GPSLatitude': {'value': 40}, 'GPSLongitude': {'value': -73}, 'GPSMapDatum': {'value': 'NAD27'}}]:
            self.assertIsNone(camera_coordinates(metadata))

    def test_nearby_complete_address(self):
        camera = {'latitude': 40.758, 'longitude': -73.985}
        feature = {'geometry': {'coordinates': [-73.9851, 40.7581]}, 'properties': {'housenumber': '1540', 'street': 'Broadway', 'locality': 'New York', 'region_a': 'NY', 'postalcode': '10036'}}
        address = address_from_result({'features': [feature]}, camera)
        self.assertEqual(address['street'], '1540 Broadway')
        self.assertEqual(address['city'], 'New York')
        self.assertEqual(address['postal_code'], '10036')
        self.assertTrue(address['approximate'])
        self.assertLess(address['distance_m'], 150)
        feature['geometry']['coordinates'] = [-74.1, 40.8]
        self.assertIsNone(address_from_result({'features': [feature]}, camera))
        feature['geometry']['coordinates'] = [-73.9851, 40.7581]
        del feature['properties']['postalcode']
        self.assertIsNone(address_from_result({'features': [feature]}, camera))
        self.assertIsNone(address_from_result({'features': []}, camera))


if __name__ == '__main__':
    unittest.main()
