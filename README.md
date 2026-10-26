# photo-clock

A clock told through photographs of New York City, using recorded camera capture
times from Wikimedia Commons. The live collection is a bounded research sample,
not a census of Commons and not a live per-minute search.

- [Clock](https://amandayehh.github.io/photo-clock/)
- [Coverage map and source inventory](https://amandayehh.github.io/photo-clock/coverage.html)

## Run and verify

`npm run dev` serves `dist/` at http://127.0.0.1:8780/.

```sh
npm ci
npm test
python3 -m unittest discover -s test -p '*_test.py'
```

Push to `main` to test and deploy `dist/` to GitHub Pages. All asset URLs are
relative to support the repository subpath. The prior Sites manifest is retained
for provenance; GitHub Pages is the active publishing target.

## Clock behavior

The bottom clock follows America/New_York, including EDT/EST. Exact capture-minute
matches are randomly selected. Missing or exhausted minutes search backward for
an unseen photo, wrapping midnight. History is per open page session and clears
on refresh. If every photograph has been shown, the current one stays. Failed
images try alternatives and are retried after a minute.

Cards preserve equal photographic area across aspect ratios, stack in arrival
order, and animate for one second. Grid view uses four, six or eight columns by
viewport width. Hold still for 0.6 seconds to show metadata; releasing restores
the front. Overflowing backs scroll to the end. Drag toward the Learn more edge
and release to open the original Commons page. Space holds details, arrow keys
move the card, and Enter opens full credits. Reduced-motion preferences disable
automatic animation. Suisse Int'l Regular is used for typography.

Corner smoothing uses the vendored MIT-licensed `figma-squircle` 1.1.0.

## Expand the Commons collection

```sh
python3 scripts/expand_commons.py
python3 scripts/enrich_locations.py
python3 -m venv .cache/report-env
.cache/report-env/bin/python -m pip install -r scripts/report-requirements.txt
.cache/report-env/bin/python scripts/build_coverage.py
```

Discovery uses five-borough night, dawn and early-morning searches, neighborhood
searches, selected categories, and additional geographic points. Requests are
sequential, cached in `.cache/commons-expanded`, and stop on HTTP 429. Each run
has bounded result caps. Reruns preserve existing photos and skip existing IDs;
request failures and rejection reasons are recorded in `commons_expansion`.

Qualification requires a valid camera `DateTimeOriginal`, supporting camera
metadata, a short edge of at least 480 pixels, and NYC geographic or text evidence.
The expansion accepts CC BY, CC BY-SA, CC0 and public-domain license labels with
photographer attribution. Known exclusions, apparent nonphotos, explicit stitched
composites, conflicting metadata and matching image SHA-1 hashes are rejected.
No image originals are downloaded. Imported images remain on Wikimedia servers.

Time-zone offsets, when available, are converted to New York time. Otherwise the
camera clock is assumed local, and this assumption appears in full credits.
Locations and times can be inaccurate. Metadata qualification does not establish
that the camera clock was correct or substitute for visual/rights review.

The original baseline contains 482 photos covering 298 capture minutes. The
current counts, per-minute availability and all source links are generated from
`dist/photos.json` into `dist/reports/` and `dist/coverage.html`. Newly covered
minutes are highlighted against the baseline. The inventory also identifies
Commons files with known Flickr origins; these are Commons-hosted files and do
not require direct Flickr API access. No direct Flickr photos are included.

## Camera-location addresses

The address enrichment script uses Commons Camera location fields and NYC
Planning GeoSearch, caching results in `.cache/camera-addresses.json`. Only nearby
results within 150 meters with street, city and ZIP code are displayed. Missing
coordinates or incomplete/distant matches omit the Location row. Addresses are
approximate nearby mapped addresses, not verified camera doorsteps.

Sources: [Commons Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo),
[Commons camera locations](https://commons.wikimedia.org/wiki/Template:Location),
[NYC Planning GeoSearch](https://geosearch.planninglabs.nyc/docs/),
[NYC borough boundaries](https://data.cityofnewyork.us/City-Government/Borough-Boundaries/gthc-hcne).

## Verification limits

Automated checks cover selection, session history, DST, motion lifecycle,
interactions, sizing, metadata eligibility and coverage calculations. Browser
inspection is currently blocked by saved permissions; the new collection has
not been visually reviewed photo by photo. Coverage-map PNGs are checked locally.
