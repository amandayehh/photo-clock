# New York Minute

A buildless photographic clock using the stage-one Wikimedia Commons sample.

## Run locally

`npm run dev` serves `dist/` on http://127.0.0.1:8780/.
`npm test` checks the clock's time calculations, stable selection, midnight
fallback, daylight saving behavior, and all 1,440 minutes against the sample.

## Behavior

- Clock time is always America/New_York, independent of the visitor's device zone.
- Photographs match their recorded capture minute, ignoring year and calendar day.
- Missing minutes hold the last eligible photograph. Initial visits look backward
  through the index and wrap across midnight using the prior selection date.
- Daily deterministic selection groups photographers, then same-date camera
  sequences, so a large burst does not buy more chances for its photographer.
- Within a sequence, stronger time/location metadata is preferred; remaining ties
  use the daily hash. Refreshing does not change the choice unless a file fails.
- Image failures try alternatives and earlier photos, keeping the existing image
  until a replacement successfully loads. The interface offers a retry control.
- Explore the day is explicitly separate from live mode and can return to now.
- Photos are displayed with object-fit: contain, without cropping or alteration.
  Each caption includes credit, license, Commons source, recorded date/time, and
  whether the capture time zone is assumed.

## Scope

The static dataset contains 482 provisional photographs spanning 298 minutes.
It is not a fully curated release collection. There is no automatic Wikimedia
discovery or synchronization yet. Remote photos remain hosted by Wikimedia and
can be unavailable or rate-limited. Most camera timestamps are assumed local.
The About panel makes these limitations visible.

No private study files, original image binaries, or credentials are included in
the site. `dist/photos.json` contains only the public metadata used by the clock.

## Verification

The server returned HTTP 200 and the pure selection/time tests pass. Browser
inspection permission was declined, so visual layout, remote image rendering,
and full browser interactions remain unverified.
