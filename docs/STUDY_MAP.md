# MusicStruct: study map and demonstration guide

## What to demonstrate

1. Search > Spotify dataset: Shape of You / Memories. These are imported feature records, not Spotify audio. The uploaded ZIP had 32,833 CSV rows, 28,355 unique valid tracks after ID deduplication, and no recordings. One row with unusable feature data was rejected. Search reads a paginated catalog; it does not materialize all 28,355 tracks in PostgreSQL or fetch audio for them.
2. Playlists > Vocal recordings: a full public-domain USAF jazz-vocal Amazing Grace performance, plus a 30-second CC BY-SA choir excerpt. Source and attribution travel with the records. These recordings were actually downloaded and validated as OGG.
3. Search > playable recordings: click a title. One shared custom bottom player handles playback, seek, volume, queue navigation, repeat, and stop/clear (×). No per-row native audio controls.
4. Search a title, play it twice: the browser's listening event stack gains two separate events. Pausing/resuming is not a new event. Played-from-search history shows newest entries first; removing an entry hides it from search history without reducing the listening trend counts.
5. Trends: genre frequencies and known-feature averages over the last 100 plays. Suggestions rank recent songs by play frequency. This is an adaptive statistical baseline, not trained ML. Histories are local to this browser, with up to 5,000 entries (500 if storage quota forces compaction); no account sync.
6. Analytics: choose an annotated song for the section/layer timeline, then a second song for the C weighted comparison bars. Unknown features have zero weight; remaining weights are normalized. Spotify features are supplied dataset values.
7. Upload audio: browser-supported files under 100 MiB and 15 minutes are decoded, resampled to mono 22,050 Hz WAV, saved, and analysed by C. Upload makes estimated loudness-change regions and one mixed-recording layer. It does NOT identify real verses/choruses or separate stems/instruments. Use Edit clips to supply actual section/instrument annotations. Direct Attach audio supports WAV/MP3/M4A/OGG/FLAC; direct compressed attachments do not run WAV DSP.
8. Export audio: choose one saved song. Its stored audio downloads with an attachment filename. Metadata-only songs cannot be downloaded as audio.

## Data structure and algorithm map

| Concept | Implementation | Actual purpose / complexity |
|---|---|---|
| Singly linked list | backend/src/linkedlist.c, component.c | Section and instrument-clip traversal. O(s+c) traversal; some distinct-instrument counting uses nested scans. |
| Hash table / chaining | backend/src/hashtable.c | Song-ID lookup, average O(1), worst O(n). |
| FIFO linked queue | backend/src/queue.c and engine.c | Pending arrangement jobs, O(1) enqueue/dequeue after loading. DB preserves jobs between processes. |
| Linked LIFO undo stack | backend/src/engine.c | Materializes history and pops the latest undo operation. O(h) loading; O(1) top removal. |
| Array-backed listening history | frontend/src/listening.mjs | Push repeated successful play events; newest-first traversal. An in-memory push is amortized O(1), but serializing browser storage is O(h). |
| Search-history view | frontend/src/Trends.jsx | Filters listening events and reverses them for newest-first presentation. Removing an arbitrary entry is O(h); this extension is NOT a pure push/pop-only stack. |
| Map / Set | listening.mjs, Trends.jsx, catalog.mjs, discover.mjs | Frequency counting, ID deduplication, provider lookup, and excluding all playlist members. |
| KMP prefix table | backend/src/algorithms.c | Local metadata substring matching, O(text + pattern) per field. External catalog search currently uses JavaScript substring matching, not C KMP. |
| Stable merge sort | backend/src/algorithms.c | Local library sorting, O(n log n) time / O(n) auxiliary memory. |
| Bounded min-heap | backend/src/algorithms.c, engine.c catalog-rank | C top-k ranking, O(n log k), plus O(k log k) output heap sort. Current Discover is tempo-based. |
| Weighted feature score | backend/src/algorithms.c | Tempo, energy, danceability, valence and genre. Analytics uses only mutually known factors. |
| Sweep line | backend/src/algorithms.c inspectArrangement | Sort start/end events and scan active clips: O(c log c) overlap/coverage stage. Touching endpoints do not overlap. |
| LCS dynamic programming | backend/src/algorithms.c sectionLCS | Ordered section-label similarity: O(a*b) time, O(b) working memory. |
| Greedy interval lane packing | frontend/src/Arrangement.jsx | Sort clips, place each into a non-conflicting lane of the same name. Distinct from C overlap calculation. |
| Audio arrays / DSP | backend/src/audio.c | WAV samples, RMS/peak/clipping, waveform bins and a tempo estimate; confidence is not a calibrated probability. |
| Loudness-change segmentation | frontend/src/AudioLibrary.jsx | Four-second sample windows, thresholded RMS differences, at least eight seconds between boundaries, at most twenty estimated regions. Not an ML segmentation model. |
| Frequency profile | frontend/src/listening.mjs and Trends.jsx | Last-100-event averages and genre counts. Repeated tracks contribute repeatedly. Suggestions sort frequency counts. |

PostgreSQL stores songs, annotations, audio metadata, playlists, queue jobs and undo history. Browser listening/search history is currently separate. Database indexes are PostgreSQL internals, not handwritten C trees.

## Limitations to state honestly

The Spotify CSV contains neither audio files nor section/stem annotations. Uploaded compressed audio may fail if the browser lacks its codec. There is no source-separation model, automatic verse/chorus classifier, trained recommender, or Spotify stream bypass. Real instrument layers require annotations. The choir recording is an excerpt, not a full commercial track.

## Verification

Core C, database, API and launcher tests: .local/companion-verification.log.
Expanded browser tests (playback history, duplicate events, removal, uploads, download headers, comparison graphs, 320 px layout): .local/companion-browser.log.
Real catalog and downloaded vocal recordings: .local/companion-live.log.

Restart Start-MusicStruct.cmd after this backend update, keep the launcher open, then refresh the browser. Old running Node processes do not load newly edited endpoints.
