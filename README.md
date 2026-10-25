# New York Minute

A minimal photographic clock, adapted from Figma file
BcIVNvRTYHZrEXbR4rCSC0, node 1:24, with live Wikimedia-derived collection imagery.

## Run and verify

- `npm run dev` serves `dist/` on http://127.0.0.1:8780/.
- `npm test` checks New York time, midnight and DST behavior, random selection,
  all 1,440 fallback minutes, title cleanup, equal-area sizing and entrance frames.

## Interface

The page contains a near-black canvas, a stack of white photo cards with small
alternating rotations and drop shadows, and the current NYC time at the bottom.
Every newly selected image enters at full opacity along a sampled cubic Bezier
curve from above the viewport, settling over earlier cards in 1.8 seconds. Cards
remain in the current page session. Empty minutes do not add cards. Reduced-motion
preferences place new cards immediately without the entrance movement.

The photograph surface area is based on a square whose side is 50% of the shorter
viewport dimension. Width = sqrt(area * aspectRatio); height = sqrt(area /
aspectRatio). One shared fit factor reduces all photographs equally if the
collection's widest or tallest ratio would exceed the viewport. Padding, title,
and shadow are outside the equal photographic area. Resizing recomputes all cards
with the same reference area. Images retain their full aspect ratio without crops.

Names remove the File: prefix, extension, underscores, and parenthetical segments,
including nested parentheses. Very long names fit into one line and may ellipsize;
the complete cleaned name is accessible in the card's details. Clicking or keyboard
activating the top card opens author, capture-time, source and license information.
The main view has no navigation, headings, explorer or promotional copy.

## Collection and clock behavior

The static dataset contains 482 provisional photographs across 298 minutes. It is
not a fully curated release collection, and automatic Wikimedia synchronization
is not yet connected. Time is always America/New_York, including daylight saving.
Most capture timestamps are assumed local; this is disclosed in photo details.

Missing minutes hold the previous image. Initial visits look backward across
midnight when needed. Deterministic random selection first groups photographers,
then photographic sequences, to avoid letting bursts dominate selection. Failed
images try alternatives and earlier moments without removing the existing stack.
An unchanged held photo is not reprinted. Failed loads are retried after a minute.

Remote images remain on Wikimedia. Public metadata only is in dist/photos.json.
No private study files, image originals, or credentials are included in the site.

## Verification limits

Fourteen automated tests and JavaScript syntax checks pass. The Figma screenshot
and node styles were read. Browser inspection was previously declined; visual
layout, image loading, and actual browser animation playback remain unverified.
The design photographs are dynamic content slots populated from the collection,
not static Figma image assets. Arial/Helvetica substitutes for the unavailable
licensed Test Söhne font.

Corner smoothing uses `figma-squircle` 1.1.0 (MIT), vendored in `dist/vendor/` with its license. The card silhouettes and image clipping paths use `cornerSmoothing: 0.6`. After upgrading the package, copy its `dist/index.js` and `LICENSE` into those vendor files.

## Camera-location addresses

Run `python3 scripts/enrich_locations.py` to enrich the saved collection. The script
reads Commons `GPSLatitude` / `GPSLongitude` from `imageinfo.extmetadata`, which are
the page's Camera location fields, then reverse-geocodes them with NYC Planning
GeoSearch. It does not use the subject's location or infer coordinates from a borough.
Requests run sequentially with a delay and are cached in `.cache/camera-addresses.json`;
existing photo records also prevent repeated lookups. `--refresh` rechecks Commons
coordinates while retaining the geocoding cache. No API key or runtime map request
is required by the published website.

Only nearby results (within 150 meters) with street, city, and ZIP code are shown.
The address represents the nearest mapped address, not a verified camera doorstep.
Missing coordinates, incomplete addresses, and distant matches omit the Location
row. Public provenance, lookup date, coordinates, and distance are stored with each
resolved address in `dist/photos.json`. Address attribution appears in full credits.

Sources: [Commons camera locations](https://commons.wikimedia.org/wiki/Template:Location),
[CommonsMetadata API](https://www.mediawiki.org/wiki/Extension:CommonsMetadata),
[NYC Planning GeoSearch](https://geosearch.planninglabs.nyc/docs/).
Run `python3 -m unittest discover -s test -p '*_test.py'` for ingestion checks.
