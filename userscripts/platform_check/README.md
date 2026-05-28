# Platform check

Find URLs for particular MB release on online platforms.

## Overview

The userscript tries to find URLs of the release on different platforms. It uses web scrapping or public API for that. If there is platform specific URL in the release relationships, it will use that URL, otherwise, it will try to find release using platforms search feature.

Once URL is determined, the script will get number of tracks and compare them to MB release so user can spot any differences and know if URL is potentially adequate for the release or not. It will possibly present other diferiating data if able to find them (year, label).

## Platforms

1. Spotify
1. Discogs
1. Bandcamp

## Options

1. The user can enable/disable particular platforms
