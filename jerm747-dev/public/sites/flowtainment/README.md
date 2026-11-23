# Flowtainment UI preview

Serve the folder containing `index.html` over HTTP or HTTPS. With Python installed, run `python3 -m http.server 8000` from that folder, then open `http://localhost:8000`. There are no build dependencies or API keys. Keep the media, art, and assets folders beside the HTML file.

## Interface rules

- Home stays within the viewport. On phones in portrait, Home, Search, Live TV, and My List stay in a fixed bottom bar. Only the catalog scrolls vertically. Genre chips can scroll horizontally as space runs out.
- In short landscape windows, the spotlight sits beside the list. Video uses the whole viewport in either orientation, with its aspect ratio preserved. Changing layout keeps the same video element and playback position.
- Small bold labels organize the phone interface. Program metadata stays secondary, and captions use the video caption renderer. On wide screens, select **Profile → Settings → Large-screen layout → TV distance** for larger controls and three cards per row. Arrow keys move focus, Enter selects, and Escape goes back.
- Home opens in Guest mode on a new device. Playing is open to guests. Saving asks for a local Kia or Jerm profile. Each has a separate watchlist and resume positions. The profile picker initially focuses Kia.
- Play checks the browser's supported sources and waits for the video to be playable before the optional four-second intro. The intro can be skipped, and resume bypasses it. The player tries another supported source when the initial check fails. An error offers Retry. No membership or promotion interrupts the program.
- The Home lineup opens in poster view. Use the icon beside the genre filters to switch between posters and compact rows. The choice persists on this device. Search uses compact rows, and My List uses posters.
- Selecting a Home card updates the spotlight. Play, Details and the highlighted card follow that selection in both lineup views. Spotlight arrows follow the current genre, and browsing keeps the lineup’s scroll position. Search and My List still open details directly.
- A gold drop lands first in the four-second intro. The header wordmark rises from the surface, holds, then refracts and dissolves as a ripple passes through it. The original intro sound is timed to the impact. The inline player covers source changes until a video frame is ready; browser-required manual playback uses the transport Play control.
- The spotlight advances only on request. The video controls fade during pointer or touch playback. Keyboard navigation keeps focus visible. Settings, captions, and card details open on request.

## Media in this preview

| Program | Media | Captions |
| --- | --- | --- |
| Block Party Blvd. | 12-second reference sample. H.264 1080p, HEVC 720p, VP9 WebM 720p and native HLS when supported | Supplied English WebVTT |
| Hi-Top Highway | 10-second H.264 540p sample | None supplied |
| Saturday Fresh | 10-second H.264 540p sample | None supplied |
| Uptown Cousins | 10-second H.264 540p sample | None supplied |

Four additional catalog entries have their own artwork, details, saved state, and resume position. They reuse these supplied clips.

| Catalog title | Clip played |
| --- | --- |
| Midnight Frequency | Block Party Blvd. |
| Kickflip Crew | Hi-Top Highway |
| Mic Check | Saturday Fresh |
| Sunday Supper | Uptown Cousins |

The original HLS and DASH test packages are included. The player offers only formats the browser advertises. The DASH files are available for later player integration. There is no bundled JavaScript HLS or DASH engine. Use a static host that serves video with the correct MIME types and supports byte ranges, including text/vtt for captions and application/vnd.apple.mpegurl for HLS playlists.

## Review scope

The supplied ZIP contained media only. This review build adds a new wordmark, eight illustrated or photographic covers, and a static front end around the supplied media. Key art and program descriptions are illustrative. The playable files are the original test clips. Search and saved programming run locally. Live TV shows its off-air state. The welcome and membership screens are available under Settings. Plan selection is a local preview. Accounts, billing, live broadcasts, uploads, a database, and native TV apps are outside this pass.

Roboto Black Italic is distributed under the Apache License 2.0. See assets/licenses/Roboto-LICENSE.txt.
