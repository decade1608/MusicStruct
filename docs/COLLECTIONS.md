# Search and playlist collections — 16 November 2026

## Everyday workflow

- **Search:** Search the Incompetech catalog inside MusicStruct. Preview full recordings, choose a destination playlist, then Add to playlist. MusicStruct saves a local audio copy and keeps the artist, source and CC BY 4.0 attribution. No Spotify account or subscription is involved. This catalog is not the complete commercial music catalog.
- **Playlists:** Create and rename editable playlists, add local tracks, and remove members. This page contains playlists only; clicking a member title opens its track inspector and arrangement. Removing a playlist or member does not delete the underlying song or audio. The first migration creates My music with existing non-synthetic songs; it does not recreate it after deletion.
- **Discover:** Choose a playlist and its source track, then Find similar tracks. The C bounded min-heap ranks catalog candidates by tempo, excluding members of every playlist. An optional search narrows candidates. Ranking downloads no audio and creates no local songs. Compare tempo shows a detailed tempo-only comparison and caches candidate metadata without playlist membership. Unknown tempo prevents comparison; scores do not claim mood or audio similarity.
- **Analytics:** The analysis workbench replaces side-by-side ranking and the standalone queue tab. Add individual tracks or queue a whole playlist; Analyse this playlist also opens Analytics. Process or cancel queued jobs here. The C/PostgreSQL command adds arrangement-report jobs in playlist order within one transaction, skipping already-pending tracks. Reports summarize supplied sections, instruments, coverage and overlapping layers; this is annotation analysis, not MP3 feature extraction.

Generated smart-playlist snapshots remain a separate feature from editable collection playlists.

## API

- GET/POST `/api/collections` — list or create (`{"name":"Evening"}`).
- PATCH/DELETE `/api/collections/:uuid` — rename or delete.
- POST `/api/collections/:uuid/tracks` with `songId`; DELETE `/api/collections/:uuid/tracks/:songId` — add/remove membership.
- POST `/api/collections/:uuid/queue` — returns added/skipped/total.
- GET `/api/music/search?q=...&offset=0&outside=true` — twenty results per page; outside is optional and excludes all playlist members.
- GET `/api/music/discover?sourceId=...&q=...&offset=0` — twenty tempo-ranked outside-playlist candidates per page; the source must belong to a playlist and have known tempo.
- POST `/api/music/:providerKey/save` with `playlistId` — resolve the catalog entry, download if not already attached, then add playlist membership. Duplicate adds reuse the existing song and audio. Failed downloads leave cached metadata but no new membership; retry is safe.
- POST `/api/music/compare` with `sourceId` and provider `key` — tempo-only C comparison of a playlist member with an outside candidate.

Catalog JSON is fetched from the fixed official Incompetech endpoint and cached in server memory for one hour. Downloads use only server-resolved catalog URLs; clients cannot supply a download URL. Catalog lookup requires internet; already downloaded recordings work locally. Import uses neutral placeholders required by the legacy schema for unknown features, with explicit provenance. Unknown values are excluded from the new comparison and tempo charts where applicable.

## Persistence and algorithms

`database/collections.sql` adds playlist membership, source attribution and transaction functions. The C executable dispatches these operations through libpq and still computes weighted comparisons, hash lookup, sorting and arrangement reports. A unique membership key prevents duplicates; advisory locking makes ID allocation, playlist edits and batch queueing consistent. Membership uses stable song IDs so song edits and undo preserve it. Deletes hide missing tracks from playlist views.

Restart the normal MusicStruct launcher after updating the backend. Startup applies the migration. Refreshing the browser alone does not reload Node API routes.

Tests use a fixed catalog fixture and downloaded licensed audio in isolated databases. Live catalog search and the My music migration were also checked. API coverage includes duplicate saves, source exclusion, failed download/retry, membership after song edits, playlist deletion and duplicate queue prevention.

Verification completed: C/SQL/API and launcher checks passed in .local/collections-verification.log. The updated browser suite passed end to end in .local/collections-browser.log, including in-page search, download/add-to-playlist, persisted playlist filtering, outside comparison, playlist queue, player restoration and mobile overflow. Live provider lookup and migration passed in .local/catalog-live.log. My music contains the three existing licensed recordings.

Latest workflow verification: .local/workflows-verification.log passed core C/API/database and launcher checks. .local/workflows-browser.log passed the updated playlist-only, integrated Analytics queue and ranked Discover browser flows, including 320/390 px overflow and playback restoration. .local/workflows-live.log checked the real provider and C ranking against the persistent playlists.
## Catalog and interface update — 16 November 2026

- Search opens the complete provider catalog automatically (1,443 recordings verified live), with pagination, title search and Browse all. These are existing licensed provider entries, not newly licensed commercial artists. Audio downloads only when the user saves a song; the catalog is not bulk-added to personal playlists.
- Discover requires only playlist and track selection. Results load automatically, exclude members of every playlist, and each recording has an independent destination selector. Similarity remains tempo-only.
- Create playlist now works with an optional name, generating My playlist N when blank, immediately selects the new playlist, and displays success feedback. Named creation and blank-name creation/deletion are browser-tested. A temporary live API playlist was successfully created and deleted during diagnosis; the originally reported failure was not reproduced through that API.
- Theme references https://www.csivitpune.com/: midnight navy, blue/blush accents, a fine grid, pointer glow on suitable devices, drifting background forms and result entrance animation. Reduced-motion settings and the background-motion toggle are respected. The player dock collapses track tools on desktop too, keeping playlist controls accessible.
- Production build and browser verification: .local/catalog-refresh-browser.log. Coverage includes automatic catalog browse, per-song destination selection, automatic outside-only discovery, playlist creation/persistence, queue processing, playback restoration and 320/390 px layouts.

Refresh the browser to load the updated frontend. No API or database migration is needed for this interface update.

## Discover compatibility and visible motion

The running pre-update API returned HTTP 404 / Endpoint not found for /api/music/discover despite the route existing on disk. New frontend assets had been served by that older process. A browser refresh alone does not reload Node modules.

The frontend now uses the C discovery endpoint when present and falls back only for this exact missing-endpoint response. Compatibility fetches all catalog pages with four concurrent requests, excludes all playlist members by source key and artist/title, and ranks by the same tempo formula. It does not cache candidate songs or download recordings. Other errors remain visible. Restarting the launcher enables server-side C heap ranking.

Visible motion includes a rotating vinyl record, 16 animated equalizer bars, floating notes, animated logo, hero/page entrances and button/card hover feedback. Decorative layers ignore pointer input. The motion toggle and OS reduced-motion preference disable animations. Mobile uses smaller, dimmer decorations.

Checks: .local/discover-live.log verifies both current C ranking and simulated legacy-endpoint fallback against the real catalog (1,193 candidates). .local/discover-animation-browser.log covers browser workflows, mobile overflow, animation presence and reduced-motion behavior. Launch Start-MusicStruct.cmd normally and keep its window open; tool-launched processes are not guaranteed to remain available after this session.

## Playback redirects and older API compatibility

Clicking a metadata-only catalog result checks for attached local audio first. If none exists, it opens its validated official source URL in the current tab. Spotify records therefore open Spotify instead of attempting nonexistent MP3 playback.

When an older running API lacks POST /music/:key/record, playable provider tracks use existing local audio where possible, otherwise a transient publisher-stream entry in the shared player. Transient entries are not fabricated PostgreSQL records and do not trigger invalid song-ID analysis requests. Restart the launcher for the updated catalog and local caching. This compatibility mode still depends on the publisher permitting browser playback.

Verification: tests/playback.mjs covers source validation, redirect decisions, local audio preference and old-route fallback; .local/playback-redirect-browser.log includes transient playback in the shared player as well as the full browser workflows.
