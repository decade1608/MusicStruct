# How Data Structures Help MusicStruct

**Project report · 16 November 2026**

## 1. Purpose and architecture

MusicStruct combines a music player, editable playlists, annotated song timelines, similarity comparison and listening trends. React displays the interface, a Node.js API handles requests and audio delivery, C implements core data structures and algorithms, and PostgreSQL stores durable application records.

Data structures determine how the program organises information; algorithms determine how it searches, orders, compares and analyses that information. PostgreSQL persistence complements the C structures: the C service loads working representations for operations, while the database preserves records after a process exits. Browser listening history is a separate local-storage feature.

## 2. Main data structures and their practical benefits

| Structure | Actual use | Why it helps |
|---|---|---|
| Singly linked lists | Song sections and annotated instrument clips | Accommodate a variable number of sections/clips and permit sequential traversal without a fixed-size arrangement array. |
| Hash table with separate chaining | Lookup of a loaded song by integer ID | Avoids repeatedly scanning every song when resolving queue entries or looking up a track. |
| Linked FIFO queue | Pending arrangement-analysis jobs | Preserves arrival order: the first queued track is processed first. Front/rear pointers support efficient insertion and removal. |
| Linked LIFO history stack | Undoing the latest database mutation | Makes the most recent change the next candidate for reversal. |
| Arrays | Songs, match results, timeline events, PCM samples, waveform bins and dynamic-programming buffers | Support indexed access and efficient sequential numerical processing. |
| Bounded binary min-heap | Keeping the best k similarity matches | Stores only the current best candidates while scanning a potentially large catalog. |
| JavaScript Map | Catalog-key lookup and listening-frequency counts | Associates each identifier or genre with metadata or a running count. |
| JavaScript Set | Duplicate detection and playlist-membership exclusion | Allows Discover to reject songs already present in any playlist. |
| Array-backed listening history | Repeated playback events, displayed newest first | Preserves repeated listens as separate evidence for trends rather than deduplicating them. |

### Linked lists: representing a song's arrangement

The C `Section` nodes hold a name, start time, end time and a next pointer. Instrument components use a similar linked representation. A song can therefore have a short or long arrangement without reserving an arbitrary maximum number of nodes.

For example, an annotated song might contain Intro → Verse → Chorus → Outro. Traversing the list calculates section count and average section length. A separate list stores clips such as drums from 15–60 seconds and bass from 30–90 seconds.

**Code:** `backend/include/linkedlist.h`, `backend/src/linkedlist.c`, `backend/src/component.c`.

**Cost and trade-off:** Traversal is O(s+c), where s is the number of sections and c is the number of clips. Finding an arbitrary node still requires traversal. Pointer storage and individual allocations add overhead; linked lists are not automatically faster than arrays.

### Hash table: connecting IDs to loaded songs

A song ID is mapped to a bucket using a hash function. Multiple IDs can map to the same bucket, so collision chains hold the corresponding nodes. The analysis processor uses this index to resolve queued song IDs into song pointers.

**Code:** `backend/src/hashtable.c`; the library/index integration is in `backend/src/engine.c`.

**Cost and trade-off:** Lookup is approximately O(1) on average with short chains, and O(n) in the worst case. The table has a fixed bucket count, so growing the loaded library increases the load factor and can lengthen chains. Loading the library and constructing its index also costs time; an O(1) lookup does not make the complete HTTP request O(1).

### FIFO queue: predictable analysis order

If the user queues A, then B, then C, the processor handles A first. Enqueue adds a linked node at the rear and dequeue removes one from the front. PostgreSQL stores pending jobs; the C processor reconstructs the working queue and processes the oldest entry. Batch playlist queueing preserves playlist order and skips already-pending tracks.

**Code:** `backend/src/queue.c`, `backend/src/engine.c` (`processQueue`), `database/collections.sql`.

**Cost and trade-off:** The linked enqueue/dequeue operations are O(1). Loading jobs, resolving IDs and persisting results incur additional costs. This queue analyses supplied annotations; it is not a source-separation or MP3 instrument-detection service.

### LIFO stack: undo

Undo must reverse the newest change before an older one. The C undo routine reads active history in order and pushes entries onto a linked stack, placing the newest ID at the top. It passes that top ID to the transactional SQL undo function, then releases the temporary nodes.

**Code:** `backend/src/engine.c` (`HistoryNode`, `undo`); `database/workflows.sql`.

**Cost and trade-off:** Building a stack with h history entries costs O(h). Accessing the top is O(1). Database restoration and freeing the temporary stack add work. The implementation does not maintain one permanent C stack across server requests.

### Heap: useful recommendations without sorting everything

A bounded min-heap keeps the weakest retained match at its root. Each candidate receives a similarity score. Until the heap contains k items, candidates are inserted. Afterwards, only a candidate better than the root replaces it. Heap operations restore the ordering, and the retained matches are returned in descending score order.

**Code:** `backend/src/algorithms.c` (`topMatchesWeighted`, `down`), `backend/src/engine.c` (`rankCatalog`).

**Cost and trade-off:** Scanning n candidates takes O(n log k); ordering the retained results adds O(k log k). The retained heap uses O(k) space, although the surrounding implementation also materializes candidate data. Discover pagination uses a heap large enough to include the requested offset. This is beneficial when k is much smaller than n.

### Maps and sets: useful supporting structures

Discover collects membership from every playlist, then excludes candidates by provider key and artist/title identity. A Map maps ranked catalog keys back to metadata. Trends uses maps to count genres and repeated songs.

**Code:** `api/catalog.mjs`, `frontend/src/discover.mjs`, `frontend/src/listening.mjs`, `frontend/src/Trends.jsx`.

These structures avoid unnecessary repeated scans. Their usual average lookup behaviour is efficient, but their costs should not be described as an unconditional worst-case O(1) guarantee.

### Listening/search history: a stack-like event log

Successful playback pushes an event containing a unique event ID, timestamp, song and search-origin flag. Listening to the same song twice creates two entries. The newest-first view provides stack-like access. Trends uses the last 100 events for feature averages and genre counts; frequent recent songs become suggestions.

Search history is a filtered view of these events. Removing an entry from that view changes its search flag without erasing the listening evidence used by Trends. Because it permits removal of arbitrary entries, it is **not a strict push/pop-only stack**. This distinction matters in a viva.

**Code:** `frontend/src/listening.mjs`, `frontend/src/Trends.jsx`, `frontend/src/Player.jsx`.

An in-memory array push is amortized O(1), but reading/serializing h stored events is O(h). Storage is local to the browser, normally bounded to 5,000 events, with a smaller fallback under storage pressure. This is an adaptive statistical recommendation baseline, not a trained ML model.

## 3. Algorithms built on these structures

| Algorithm | What it contributes | Main complexity |
|---|---|---|
| KMP substring matching | Searches local song metadata using a prefix array to avoid repeated comparisons | O(t+p) per searched field, for text length t and pattern length p |
| Stable merge sort | Orders the local library by title, tempo, energy, duration or ID | O(n log n) time, O(n) temporary space |
| Weighted similarity | Combines the five comparison factors into one score | Constant work per candidate for five features |
| Sweep-line interval scan | Calculates peak simultaneous clips and total annotated coverage | O(c log c) for event sorting plus O(c) scanning |
| Longest common subsequence | Compares ordered section labels of two songs | O(a*b) time, O(b) working memory |
| Greedy interval lane packing | Places overlapping timeline clips into separate visible lanes | Sorting plus lane/clip scans; not a guaranteed O(n log n) complete implementation |
| Audio sample processing | Calculates waveform peaks, RMS, clipping and a tempo estimate from supported WAV audio | Array scans plus the tempo-estimation work |

**Implementation:** Most C algorithms are in `backend/src/algorithms.c`; WAV analysis is in `backend/src/audio.c`; timeline lane packing is in `frontend/src/Arrangement.jsx`.

The sweep-line stage creates a +1 start event and a −1 end event for each clip. Sorting end events before start events at the same timestamp prevents merely touching clips from counting as overlapping. The full arrangement inspector also counts distinct instruments with nested scans, so its overall worst case includes O(c²) work; only its interval-analysis stage is O(c log c).

Tempo similarity is `1 − abs(a − b) / max(a, b)`. Other numeric features use their absolute difference on the unit interval; genre uses equality. Analytics excludes unknown factors and normalizes the remaining weights. Current external Discover ranks by tempo, not by learned audio similarity.

LCS preserves ordering: Intro → Verse → Chorus can partially match Intro → Chorus even though the sequences differ. It does not establish that the recordings sound alike.

## 4. End-to-end examples

**Find a new song:** choose a playlist song → collect all playlist memberships into sets → discard saved candidates → score outside candidates → retain the best k with the C heap → use a map to recover their catalog metadata → display the results.

**Analyse a playlist:** add pending jobs in playlist order → persist them in PostgreSQL → load the C FIFO queue → find the next song through the hash index → traverse section/component lists → run the interval sweep → store the report.

**Understand a trend:** successful playback → append a distinct listening event → inspect recent events → accumulate song/genre counts in maps and known-feature averages → refresh suggestions. Duplicate listens increase that song's contribution.

**Play a licensed recording:** resolve a trusted catalog entry → materialize its song metadata → obtain and validate the recording → save audio metadata in PostgreSQL and the file locally → deliver byte ranges to the existing bottom player. An in-flight-request map prevents simultaneous requests for the same recording from downloading it repeatedly; subsequent plays reuse the saved audio.

## 5. What the uploaded archives actually provide

| Archive | Contents inspected | Audio availability |
|---|---|---|
| `archive.zip` | `spotify_songs.csv` and dataset README | Feature metadata only; no recordings |
| `archive (1).zip` | `spotify_millsongdata.csv`: artist, song, lyrics-page link and text | Lyrics and metadata; no recordings |
| `archive (2).zip` | `merged_data.csv`: chart positions, dates, artists, Spotify URLs, stream counts and features | Chart/feature metadata; no recordings |

The third CSV is 27,104,091,782 bytes uncompressed. It was inspected inside the ZIP rather than extracted, because extracting it would consume substantial disk space without providing audio. No lyric text was imported into the interface, and these two additional archives were not treated as audio sources.

A Spotify track ID or lyrics-page URL is not an audio file. Data structures can organise identifiers and recordings, but cannot reconstruct a commercial recording from metadata. Those songs need matching audio supplied by the user or an authorised playback integration. Existing licensed catalog recordings and locally attached audio are separate playable resources.

## 6. Important distinctions for the presentation

- C structures are working representations; PostgreSQL supplies durable storage.
- The C undo stack and browser listening history are separate implementations.
- External catalog text search uses JavaScript substring matching; it is not the local C KMP path.
- Playback uses audio files. Analytics may use supplied feature metadata without having audio.
- Loudness-change regions from uploads are estimates, not automatically identified verses/choruses.
- Real instrument layers require annotations; the app does not separate mixed audio into stems.
- Current suggestions use frequency and averages, not a trained machine-learning recommender.
- Database indexes are database-engine features, not handwritten C search trees.

## 7. Suggested demonstration order

1. Play an available recording and show the shared bottom player.
2. Search a local title and explain KMP versus external catalog search.
3. Sort the library and explain merge sort.
4. Queue a playlist and show FIFO processing.
5. Inspect section lists and overlapping clips; explain the sweep-line events.
6. Compare two annotated tracks and explain weighted scoring and LCS.
7. Open Discover and explain all-playlist exclusion plus the bounded heap.
8. Edit a record and undo it to demonstrate LIFO history.
9. Replay a song twice, then show duplicate listening events and updated Trends.

The value of the project is the connection between each data structure and a visible feature—not simply the number of structures listed.

## 8. Verification for this audio-only update

The five stored real recordings were checked through the running API: the jazz-vocal and choir recordings, Carefree, Cipher and The Builder. Each returned actual audio bytes through a successful HTTP 206 range response with the expected audio MIME type. Catalog preparation returned the local playback URL.

Automated coverage includes simultaneous recording requests sharing one download, repeat playback reusing the stored file, no automatic playlist-membership changes during playback, upload validation, byte ranges, database operations, C algorithms and browser workflows. Evidence: `.local/audio-only-live.log` and `.local/audio-only-verification.log`.

This verification does not mean the metadata-only commercial tracks gained recordings. No audio was present in any of the three supplied archives.
