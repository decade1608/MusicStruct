# MusicStruct — final project

A complete local music metadata, structure, and similarity analyzer. The interface uses near-black, plum, burgundy, violet, and magenta, with a music player, responsive collection view, interactive analytics, a discovery page, and a persistent analysis queue. See docs/NIGHT_THEME.md for the redesign and Spotify limitations.

## Start

Double-click `Start-MusicStruct.cmd`, then open **http://127.0.0.1:3000**.

Or run in PowerShell:

```powershell
& 'D:\Music Struct Final\scripts\start.ps1'
```

The launcher compiles the three C targets, builds React, starts or reuses the dedicated local PostgreSQL cluster, applies the schema, imports the demo collection once, and serves the app. Keep the terminal open. Ctrl+C closes the app and stops the database if this launcher started it. A reused database is left running.

Requirements on this Windows computer: Node.js/npm, GCC at `C:\msys64\ucrt64\bin\gcc.exe`, and PostgreSQL 18 at `C:\Program Files\PostgreSQL\18`. On a fresh source-only copy, the build script runs `npm ci`; this needs internet access. The app uses no external fonts, streaming services, or paid APIs.

## Finished workflows

- Browse and search by title, artist, album, or ID; filter genre; sort by title, tempo, energy, duration, or newest ID.
- Inspect musical features and the annotated arrangement; zoom the timeline and inspect clip times. Repeated instruments share a lane when their clips do not overlap.
- Add and edit songs in three short steps. Delete a song with confirmation. Undo additions, edits, and deletions from newest to oldest.
- Compare two tracks using the original five weighted features, plus a separate ordered-section similarity score.
- Discover the six closest musical matches with deterministic ranking.
- Queue tracks for arrangement reports. Process the oldest pending job, cancel pending jobs, and view recent completed reports.
- Export a collection as JSON. Import up to 1,000 records / 2 MB atomically; existing IDs are skipped and preserved. Invalid records reject the entire request before any import occurs.
- Preserve songs, annotations, history, and analysis jobs across restarts. Deleted demo songs stay deleted.

## Data structures that do real work

| Structure / algorithm | Product use |
| --- | --- |
| Hash table | Song-ID lookup and attaching annotations to songs |
| Linked lists | Ordered sections and instrument clips used in arrangement reports |
| KMP substring search | Library text search |
| Stable merge sort | Library ordering |
| Bounded min-heap | Top-six recommendations |
| FIFO linked queue | Oldest-first arrangement-report processing |
| Linked stack | Last-in-first-out undo of persistent history |
| Sweep-line algorithm | Peak simultaneous instrument clips and annotation coverage |
| Longest common subsequence / dynamic programming | Ordered-section similarity |

The recovered terminal demo additionally demonstrates linear search. The web service uses the C implementations above, not JavaScript replacements. Full costs, limitations, and file locations are in `docs/ALGORITHMS.md` and the in-app **Under the surface** page.

## Architecture

```text
React + Vite → Node.js HTTP adapter → C executable → PostgreSQL / libpq
                                      ├─ algorithms.c
                                      ├─ linked lists / hash / queue
                                      └─ transactional workflows
```

Node validates HTTP input and spawns the C service directly without a shell. C reads and writes PostgreSQL, loads the data structures, and computes comparisons/reports. PostgreSQL stores songs, ordered sections, ordered components, analysis jobs, change history, and initial-seed metadata.

The dedicated database defaults to `.local/postgres`, port 55432, database/user `musicstruct`. It listens on loopback and uses trust authentication for a single-computer demonstration, so other local processes can connect without a password. This is a local application, not a hosted multi-user service.

Optional environment variables:

- `MUSICSTRUCT_DATABASE_URL`: an existing dedicated PostgreSQL connection string; the launcher does not manage that server. Supply credentials in the environment or a PostgreSQL password file, not source code.
- `MUSICSTRUCT_PGPORT`: local cluster port (default 55432).
- `MUSICSTRUCT_DATA_DIR`: local cluster directory (default `.local/postgres`). Never point two running servers at the same directory.
- `PORT`: HTTP port (default 3000).
- `MUSICSTRUCT_PG_BIN`: PostgreSQL utilities location for the launcher. The build and C DLL search currently use the PostgreSQL 18 installation above.

## Verify

```powershell
& .\scripts\build.ps1
node .\scripts\verify-all.mjs
```

The complete runner creates an isolated PostgreSQL cluster, runs C and API/database tests, verifies the launcher and restart behavior, and runs browser tests. It never modifies the application's collection. It uses installed Chrome by default; set `MUSICSTRUCT_BROWSER` to another Chromium executable if needed. The browser uses a separate temporary profile. A restricted test environment may require its `--no-sandbox` flag; normal app usage does not.

Test files and screenshots remain under `.local/verification-*` and `.local/screenshots` for diagnosis, and are excluded from source backups. `scripts/test.ps1` can also run C/API checks against a running local cluster using disposable databases. Set `MUSICSTRUCT_TEST_PORT` if it is not on 55432.

## Backups and recovery

Use **Export** in the app for a portable song/annotation backup; **Import** skips IDs already present. To copy the entire database, including queue and history, use PostgreSQL's dump tools while the server is running:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h 127.0.0.1 -p 55432 -U musicstruct -d musicstruct -Fc -f musicstruct-data.dump
```

Keep the source ZIP and data dump separately. Source archives include demo JSON but exclude local databases, dependencies, logs, and compiled binaries. Restore a dump into a newly created, empty dedicated database with `pg_restore`; do not overwrite a working collection without a backup.

## Scope

The 15 bundled tracks, features, and annotations are synthetic. Real metadata can be imported or entered manually. The backend now supports local audio streaming, basic automatic WAV analysis, custom similarity weights, smart playlists and CSV import. These additions are API-ready; their frontend controls are the next phase. See `docs/BACKEND_NEXT.md` for contracts and limitations. MusicStruct does not use machine learning. Its timeline is an annotation viewer with form-based editing, not a drag-and-drop audio workstation. Time signature stores beats per bar and assumes a quarter-note denominator.

Genre similarity is an exact case-sensitive match. KMP search ignores ASCII case and matches other UTF-8 bytes exactly. A similarity score describes supplied metadata, not a prediction of personal taste. Undo restores song data and annotations; it clears that song's analysis jobs so reports can be regenerated. History is local and global to this single-user workspace, with no redo.

`backend/bin/musicstruct-cli.exe` remains an in-memory teaching demo. The web application uses the persistent C service. The original empty `song.txt` is retained as recovered material; active import/export uses JSON.



## In-app search and playlists
Search now uses the freely licensed Incompetech catalog inside MusicStruct. Collection manages editable playlists; Discover compares playlist tracks with outside candidates; Analysis queue accepts whole playlists. See docs/COLLECTIONS.md for setup, API routes, persistence and limitations. Restart the launcher to load the new API routes.


## Companion update — 16 November 2026

See [docs/STUDY_MAP.md](docs/STUDY_MAP.md) for current workflows, implementation locations, algorithm complexity, demo steps and known limitations.

The user-supplied Spotify ZIP is metadata-only. The catalog includes 28,355 unique dataset records plus 1,443 Incompetech entries and two Wikimedia vocal recordings (29,800 total at verification). Catalog records are materialized in PostgreSQL when selected/saved; the full dataset is paginated from backend/data/spotify-catalog.json. Vocal recordings were downloaded into the Vocal recordings playlist. Shape of You and Memories were saved as feature metadata in Spotify features · attach audio.

New features: shared custom bottom player, stop/clear, row-based song results, audio upload/download picker, arrangement and factor panels inside Analytics, per-browser listening history, played-from-search history, and repeat-sensitive frequency suggestions. A complete audio-free Spotify record cannot be played or downloaded. Upload segmentation uses estimated loudness regions, and real instrument layers require annotations. Trends is an adaptive statistical baseline, not trained ML. Restart the launcher for the new API routes.

## YouTube playback update

Metadata-only tracks now open a visible YouTube panel when no local audio is attached. Local recordings still use the existing bottom bar. Verified artist/title links are provided for Shape of You (Ed Sheeran) and Memories (Maroon 5); other videos can be linked and remembered per song. Exact matching deliberately excludes remixes. Playlist Play buttons and history replay use the same routing.

YouTube controls stay visible. The app pauses native audio while the panel is open, stops video on close, pauses video when the tab is hidden, and logs listens only on actual PLAYING events. Embedding/region/account restrictions still apply; a blocked video offers an external YouTube link and replacement-link input. No YouTube audio is downloaded or analysed.

Optional automatic search requires YOUTUBE_API_KEY in the server environment, with YouTube Data API v3 enabled. Without a key, verified links and pasted links work without API search. API credentials never go to the frontend. Restart the launcher after configuring the environment.

Updated report: [reports/MUSICSTRUCT_DSA_REPORT_YOUTUBE.md](reports/MUSICSTRUCT_DSA_REPORT_YOUTUBE.md). Deterministic checks: tests/youtube.mjs and .local/youtube-verification.log. Live external-service evidence: .local/youtube-live.log; network playback is not guaranteed by the stub-based tests.

Live verification: the YouTube API example player reached ready state, but the tested official Shape of You and Memories videos rejected embedding. Those songs offer external YouTube links. No successful audible commercial-song playback is claimed.

## Playable-only catalog cleanup

The active Spotify metadata catalog is now empty and no longer loaded. Search and Discover contain direct recording sources only (1,443 Incompetech entries and two vocal recordings). Two saved metadata-only songs were removed; six saved songs remain with local audio or a direct recording source. Playlist references, analysis jobs and undo records for deleted songs were removed. Video-only browser history is removed when read. Remote recording availability still depends on the publisher. Backup: `.local/backups/playable-only-1794837476442`.
