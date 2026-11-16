# Algorithms and implementation

The algorithms are deliberately connected to visible workflows. Opening **Under the surface** in the application shows the same mapping without putting technical terminology in the normal music views.

| Implementation | Workflow | Cost of the algorithm itself |
| --- | --- | --- |
| `backend/src/hashtable.c` | Find a song ID, connect database annotations to song records, identify comparison tracks | Expected O(1) lookup; O(n) worst case with collisions; separate chaining |
| `backend/src/linkedlist.c`, `component.c` | Preserve section/clip order and traverse arrangements | O(s+c) traversal; current append-based construction can take O(s²+c²) per song |
| `containsKMP` in `algorithms.c` | Search concatenated title/artist/album/ID text | O(t+q) time and O(q) extra space per track |
| `sortSongs` in `algorithms.c` | Stable title/tempo/energy/duration/newest-ID ordering | O(n log n) time, O(n) temporary pointers |
| `topMatches` in `algorithms.c` | Return six highest-scoring other songs | O(n log k + k log k) time, O(k) matches; k=6 |
| `queue.c` + `processQueue` in `engine.c` | Persist pending jobs, materialize them in ticket order, process the oldest | O(1) enqueue/dequeue; O(j) reconstruction plus library loading |
| `HistoryNode` + `undo` in `engine.c` | Restore the newest un-undone journal entry | O(1) push/pop; O(h) reconstruction |
| `inspectArrangement` in `algorithms.c` | Count simultaneous clips and union coverage | O(c log c) sweep; distinct-instrument counting currently uses O(c²) comparisons |
| `sectionLCS` in `algorithms.c` | Find section labels shared in order | O(a×b) time, O(b) auxiliary memory |
| `searchSongById` in `song.c` | Terminal teaching menu | O(n) linear search |

Symbols: n songs; s sections; c component clips; t searchable text length; q query length; j queued jobs; h undo history; a and b section counts.

The C executable runs per HTTP request. Loading PostgreSQL rows, constructing the hash table/lists, and serializing JSON are additional costs. The small demo collection does not need a long-lived in-memory cache. This implementation prioritizes visible, testable data-structure use over claiming constant-time end-to-end requests.

## Weighted musical similarity

For normalized features, similarity is `1 - abs(x-y)`. Tempo uses `1 - abs(a-b) / max(a,b)`. Valid input requires positive tempo and normalized features in [0,1]. Genre is 1 for identical strings, otherwise 0.

```text
score = .25 × tempo
      + .20 × energy
      + .20 × danceability
      + .15 × valence
      + .20 × genre
```

The recommendation heap excludes the source song. Equal scores prefer lower song IDs, so results are deterministic. The heap root is the worst retained candidate; a better candidate replaces it and sifts down. Heap sort orders the final six results without sorting the whole collection.

## Arrangement analysis

Each component interval creates a +1 start event and a -1 end event. Events are sorted by time, with ends before starts at the same time. The sweep tracks the number of active clips and accumulates duration only while at least one clip is active. Consequently, touching clips do not inflate the peak and overlapping intervals are not counted twice in coverage. "Unannotated" time means no instrument annotation exists; it does not imply audible silence.

The report includes section count, component count, distinct instrument labels, peak simultaneous clips, covered/unannotated seconds, coverage ratio, and average section length. The UI groups repeated instrument clips into non-overlapping lanes for display; that visual lane-packing step is JavaScript, while the numerical report is calculated in C.

## Structural similarity

Longest common subsequence compares section labels in their stored order, ignoring ASCII case. It can match `Intro → Verse → Chorus → Outro` with `Intro → Chorus → Outro` by retaining the shared order even when a section is missing.

The separate score is `2 × LCS length / (section count A + section count B)`. If either track lacks sections, the UI labels the structural comparison unavailable. This score measures label-sequence agreement; it does not compare audio, timing, harmony, or segment duration.

## Persistent queue and undo

PostgreSQL is the durable representation of queue tickets and history entries. C reconstructs a FIFO queue or LIFO stack for the current operation. Mutations and job processing use one transaction-scoped PostgreSQL advisory lock so competing C processes cannot process the same job or pop the same history entry concurrently.

Every user-facing add/edit/delete records a before/after document. Undo restores the newest active entry atomically, including ordered annotations. Editing/deleting/restoring invalidates that song's queued and completed reports through foreign-key cascade. Undo does not restore those reports; they can be recomputed.

Initial demo import is marked in `app_metadata`. Subsequent launches do not reinsert deleted demos. Import validates all records before starting and saves the accepted new records in one database transaction; existing IDs are skipped.
