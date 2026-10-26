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
on refresh. At New York midnight, both the cards and history reset for a fresh day;
a sleeping tab resets when it resumes. If every photograph has been shown, the current one stays until the reset. Failed
images try alternatives and are retried after a minute.

Cards preserve equal photographic area across aspect ratios, stack in arrival
order, and animate for one second. Grid view chooses between three and eight columns from viewport width, targeting
roughly 180 pixels per column including gutters to keep card sizes consistent. Hold still for 0.3 seconds to show metadata; releasing restores
the front. Overflowing backs scroll to the end. Drag toward the Learn more edge
and release to open the original Commons page. Space holds details, arrow keys
move the card, and Enter opens full credits. Reduced-motion preferences disable
automatic animation. Suisse Int'l Regular is used for typography.

The top-right help button opens the project description, Commons source link,
and latest recorded collection update in New York time. It closes on a second
click, an outside click, or Escape. Its white SVG uses the supplied
[Chunk circle-question icon](https://www.figma.com/design/UCamxllZg0jl4xETAbcafG/Chunk-Icons--Community-?node-id=54-53918), stored locally.

Corner smoothing uses the vendored MIT-licensed `figma-squircle` 1.1.0.

## Monthly collection maintenance

`.github/workflows/monthly-collection.yml` runs on GitHub on the first of each
month at 9:17 AM America/New_York (including daylight saving time). No Codex
routine, local computer, API key, or personal access token is required.

Each run checks every existing file with fresh Commons metadata and searches
newest-first text/category results plus the geographic points, checking up to
1,000 new candidates. It uses the same eligibility rules, refreshes credits and
capture metadata, and retires deleted or newly ineligible records. Street
addresses are retained only if the camera coordinates remain unchanged; missing
addresses can be added separately with the enrichment script. Original baseline
counts stay historical, with retired records recorded in `retired_photos`.

Network failures, incomplete responses, rate limits, or unusually large removals
stop the refresh before replacing the catalog. Tests must pass before the bot
commits generated files and deploys them. A concurrent source push causes a
normal push conflict, never a force-push. The previously deployed site remains
available if a run fails. A successful verification is recorded each month even
if no photos are added. The map shows net changes against the original baseline.

In GitHub **Actions → Monthly Commons collection → Run workflow**, choose
`refresh` to run the full check or `smoke` to check a small live sample without
changing or deploying the collection. Logs and run summaries show results.
GitHub schedules can be delayed; public-repository schedules may be disabled
after 60 days without repository activity. Check Actions if updates stop.

Local equivalents:

```sh
python3 scripts/refresh_collection.py --smoke
python3 scripts/refresh_collection.py
# Regenerate reports and run tests before committing a full refresh.
```

## Manually expand the Commons collection

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
