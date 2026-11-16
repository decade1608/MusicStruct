# Backend expansion — 15 November 2026

This phase adds API and C capabilities. The existing React interface remains compatible; controls for these additions are the next frontend phase.

## Custom similarity

`GET /api/compare?a=1&b=2&weights={...}` and `GET /api/songs/1/recommendations?weights={...}` accept a URL-encoded JSON object. Keys: `tempo`, `energy`, `danceability`, `valence`, `genre`. Nonnegative weights are normalized; at least one must be positive. Omitted keys are zero when supplying an object. Omitting the whole object uses the original 25/20/20/15/20 percent defaults. Comparison returns the normalized weights and individual scores. C calculates the scores and uses its bounded min-heap for recommendations.

## Smart playlists

POST JSON to `/api/playlists/preview`:

```json
{"startId":1,"targetSeconds":1800,"maxTracks":12,"weights":{"tempo":2,"energy":1}}
```

Add `"name":"Evening session"` and POST to `/api/playlists` to save. GET `/api/playlists` lists snapshots; GET or DELETE `/api/playlists/:uuid` retrieves or removes one.

C walks an implicit weighted graph of songs, choosing the most similar unvisited track to the preceding track that fits the remaining time. Ties use smaller IDs. No repeats; the starting song must fit. Limits: 1–86,400 seconds, 1–100 tracks. Cost is O(n × k), with a visited array and the library's ID hash table. The greedy result is deterministic, not a globally optimal route or exact-duration packing. Results explicitly report `optimal:false`, duration, unused seconds and transition scores. Saved playlists are snapshots: later song edits/deletions do not rewrite them. They contain metadata, not copied audio files.

## CSV preview and import

POST `/api/import/csv/preview` or `/api/import/csv` with:

```json
{"csv":"ID,Name,Artist,BPM\n501,Quiet morning,Example,90","mapping":{"id":"ID","title":"Name","artist":"Artist","tempo":"BPM"},"defaults":{"genre":"Ambient","year":2026,"duration":180,"energy":0.3,"danceability":0.4,"valence":0.5}}
```

Mapping runs from song field to CSV column. Omit it for exact field-name headers. Optional `delimiter` is comma, semicolon or tab. Supports BOM, quoted fields, escaped quotes and multiline fields. Limits: 1.5 MB CSV, 1,000 records, 64 columns; the JSON request remains limited to 2 MB. Explicit positive IDs are required. Required metadata without mapped values needs defaults. Sections/components can be JSON arrays in quoted cells.

Preview returns parsed songs, errors, duplicate-title warnings and ready/skipped counts without writing. Row numbers are logical records plus the header, not physical lines inside multiline fields. Commit revalidates, skips existing IDs and writes atomically; any invalid row rejects the batch. Duplicate IDs within a batch are errors. Concurrent collection changes or IDs reserved by retained audio can still reject a previously valid preview.

## Audio storage and playback

- PUT `/api/songs/:id/audio` with raw bytes and `Content-Type: audio/wav`, `audio/x-wav`, `audio/mpeg` or `audio/mp4`. Optional `X-Audio-Name` is a URI-encoded display filename. Limit: 100 MiB.
- GET or HEAD the same path for playback. Single byte ranges, suffix ranges, ETag validation and If-Range support seeking and caching.
- GET `/api/songs/:id/audio/metadata` or `/analysis` for JSON.
- DELETE `/api/songs/:id/audio` detaches audio and attempts file cleanup.

Uploads use generated UUID filenames and a SHA-256 digest. Data lives in `.local/media`, or `MUSICSTRUCT_MEDIA_DIR`; metadata lives in PostgreSQL. Back up both the database and media directory. JSON collection export does not include audio or saved playlists. MP3/M4A uploads get a signature check, not full decoder validation; playback requires browser codec support.

Failed uploads preserve the previous attachment. Replacement and detach remove old files on a best-effort basis. Song edits preserve attachments; song deletion hides but retains them for undo. A deleted ID with retained audio cannot be used for a new song: undo its deletion and detach first. Audio replacement/detach is not covered by song undo. Process crashes or failed cleanup can leave unused files; this version has no automatic garbage collector.

## Automatic WAV analysis

On WAV upload, Node invokes `backend/bin/audio-analyze.exe`. The C analyzer validates RIFF chunks and computes duration, channels, sample rate, RMS, RMS dBFS, sample peak, clipped-sample fraction and 128 waveform peak bins. An onset envelope and normalized autocorrelation estimate 40–240 BPM for sufficiently periodic recordings at least eight seconds long. Weak or silent signals return a null tempo. Results never overwrite manually supplied song features.

Supported: little-endian RIFF PCM 16/24/32-bit or normalized float32 WAV, 1–8 channels, 8–192 kHz, up to two hours subject to the upload size limit. Extensible/compressed WAV, RF64 and MP3/M4A analysis are not supported. Analysis has a 20-second process timeout. The implementation scans samples in O(samples), then searches a bounded set of tempo lags over an approximately 100 Hz envelope. It buffers at most the bounded file plus envelope in memory.

Tempo is an estimate and can choose half/double time. `tempoConfidence` measures periodicity, not calibrated accuracy. RMS is not LUFS or musical energy. Genre, valence, danceability, instruments, sections and machine learning remain outside automatic analysis. Validation uses synthetic pulses/silence and malformed input; this is not a real-world tempo benchmark.

## Build and verification

`scripts/build.ps1 -BackendOnly` compiles the C service, teaching CLI and audio analyzer without rebuilding React. Normal startup runs the idempotent media migration through `scripts/seed.mjs`. `node scripts/verify-all.mjs` runs C, disposable PostgreSQL/API, launcher/restart and Chromium tests. New assertions cover custom weighting, playlist persistence and constraints, CSV parsing and atomicity, WAV tempo/silence, upload cleanup, ranges/cache, attachment undo, and browser WAV decoding/seeking.
