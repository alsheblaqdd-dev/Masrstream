# MasrStream 1.2 🇪🇬

**Zero-cost code, no TMDB key needed to start.**

This Stremio addon serves a small built-in Egyptian movie and series catalog even without a movie database account. Search, metadata and Stremio endpoints work locally. Optional free TMDB credentials enable a larger catalog. **No Egyptian movie playback is included**: only authorized direct media URLs supplied by the operator can play.

## Start

Node.js 18 or newer: `npm start`. Then open `http://localhost:7000/manifest.json` in a browser to check the manifest. For Stremio on a different device, host the server on a publicly reachable HTTPS URL and install `https://YOUR-SERVER/manifest.json`. A ZIP or GitHub repository by itself cannot host a live addon.

## Optional

`TMDB_API_KEY`: free key for expanded Egyptian catalogs.

`AUTHORIZED_STREAMS_JSON`: JSON object keyed by `tmdb:ID` or `tmdb:SHOW_ID:SEASON:EPISODE`, with arrays of `{"name":"My licensed source","url":"https://example.org/video.mp4"}`. Use only URLs you have permission to share.

`PORT`: default 7000. `PUBLIC_URL`: your hosted origin.

## Tests

`npm test`

No payment, GitHub account, or external API credentials are required to run the small catalog locally. Hosting and actual licensed playback sources are separate.
