# MusicStruct

A local music player and music structure/similarity analyser built with React, a Node.js API, a C backend and PostgreSQL.

## Features

- Search licensed recording sources and save tracks to playlists.
- Shared bottom player for downloaded and uploaded audio.
- Discover tempo matches outside existing playlists.
- Inspect song sections, overlapping annotated instrument layers and comparison factors.
- Queue arrangement analysis and compare songs with weighted features.
- Listening history and repeat-sensitive Trends stored in your browser.

The active catalog excludes Spotify metadata-only entries. Remote recording availability depends on the publisher. WAV analysis estimates audio features; it does not automatically separate instruments. Trends uses statistics, not a trained ML model.

## Run locally on Windows

Install Git, Node.js 24 (includes npm), MSYS2 UCRT64 GCC, and PostgreSQL 18.
The scripts currently expect GCC at `C:\msys64\ucrt64\bin\gcc.exe` and PostgreSQL at `C:\Program Files\PostgreSQL\18`. Adjust the paths in `scripts/build.ps1`, `scripts/run-local.mjs`, `api/server.mjs` and `api/media.mjs` if installed elsewhere.

1. Clone or download this repository into a drive with enough free space.
2. Double-click `Start-MusicStruct.cmd`.
3. Keep the console open and visit http://127.0.0.1:3000.
4. Create a playlist, open Search, choose a licensed recording and add it to the playlist. Its audio is downloaded on selection. You can also upload your own audio.

The first run builds the C executables, installs frontend dependencies, builds React, initializes a dedicated local PostgreSQL cluster on port 55432 and creates the schema. Internet is required for dependency installation, catalog search and recording downloads. Build temporary files use the project drive.

A fresh copy starts with an empty song library. Synthetic records in `backend/data/demo.json` are teaching/test fixtures, not playable audio. To opt into them on an uninitialized database, set `MUSICSTRUCT_SEED_DEMOS=1` before the first launch.

## Database included in this repository

The reproducible database definition is included as SQL:

| File | Contains |
| --- | --- |
| `database/schema.sql` | Songs, sections, components, constraints and views |
| `database/workflows.sql` | Undo history, analysis queue and workflow functions |
| `database/media.sql` | Audio attachment metadata and saved smart playlists |
| `database/collections.sql` | Playlists, memberships, catalog sources and functions |

`scripts/seed.mjs` applies these files automatically. The PostgreSQL database server is installed separately. The running database files, personal records, downloaded audio and browser history are not published. Other users recreate their own database from the SQL. Audio files are not stored inside PostgreSQL; they live under `.local/media`.

To make a private portable database backup while the app is running:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h 127.0.0.1 -p 55432 -U musicstruct -d musicstruct -Fc -f '.local/musicstruct.dump'
```

Keep this backup private unless its contents have been reviewed. Restoring audio metadata alone does not restore recordings: `.local/media` must also be transferred privately, where redistribution is permitted. Do not copy the PostgreSQL data directory between machines.

## Data structures and algorithms

Linked lists represent sections and instrument clips; a hash table resolves song IDs; a FIFO queue orders analysis jobs; a LIFO stack supports undo. KMP searches text, merge sort orders records, a bounded min-heap selects similarity matches, a sweep-line algorithm measures overlap, and LCS compares section order. Arrays, Maps and Sets support audio processing, history, frequency counts, caching and playlist exclusions.

Read [the detailed report](reports/MUSICSTRUCT_DSA_REPORT_YOUTUBE.md) and [study map](docs/STUDY_MAP.md) for code locations, costs and limitations. Historical YouTube integration notes describe an earlier phase; metadata-only catalog songs have since been removed.

## Verification

The original Windows project passed backend, database, API and browser tests. This source-only publication copy has not been deployed as a hosted application. Tests use synthetic fixtures and isolated databases. See `scripts/verify-all.mjs` and `tests/`.

## Credits and scope

Recording credits and license links are shown in the app and stored in catalog metadata. Music is not bundled in this repository. Keep required attribution when using recordings. This is currently a local, single-user application; do not expose its writable API publicly without access controls.
