# Backend verification — 15 November 2026

Verified in the staged project, using disposable PostgreSQL databases. The original D: project and collection were not changed.

- C service, teaching CLI and audio analyzer compile with GCC warnings treated as errors.
- C algorithm tests passed: similarity, hash, queue, lists, search, merge sort, bounded heap, sweep line and LCS.
- PostgreSQL/API tests passed: persistence, rollback, CRUD/undo, queue workflows, import/export, UTF-8, validation and origin checks.
- New tests passed: normalized custom similarity and ranking; playlist constraints/save/read/delete; CSV quoting/mapping/preview/atomic commit; WAV synthetic 120 BPM/silence/malformed input; audio byte ranges, HEAD, ETag, replacement, cleanup, edit/delete/undo retention and ID reuse protection.
- Launcher tests passed: initialization, migrations, one-time seed and restart persistence.
- Chrome tests passed: existing desktop/mobile workflows plus actual WAV decoding, ten-second duration and seeking to eight seconds. Browser runner now explicitly closes connections during teardown.

The full run reached every passing test group but stalled during browser teardown; it was stopped. After fixing teardown, the browser suite was rerun independently and exited successfully, including database shutdown. An intervening attempt to create another disposable database ran out of disk space; reusing the existing test cluster avoided that allocation. No real audio corpus accuracy claim is made. The frontend source was unchanged; its existing production build was used for browser regression checks.

See `MusicStruct-backend-test-log.txt` for test output. API details and known limits are in the packaged `docs/BACKEND_NEXT.md`.

---

# Final verification — 13 November 2026

Completed on the Windows project at `D:\Music Struct Final`.

## Build

- C service and terminal demo compile with `-std=c11 -Wall -Wextra -Werror`.
- React/Vite production build passes.

## C and database/API tests

- Weighted similarity identity, known score, and symmetry.
- Hash lookup/misses/duplicate insertion and minimum signed-integer boundary.
- FIFO order and empty-queue behavior; linked-list order, cleanup, bounded labels, and linear search.
- KMP repeated-prefix, ASCII case, empty-query, and non-match cases.
- Merge ordering; bounded-heap exclusion, ranking, and comparison against all unselected candidates.
- Sweep-line touching/overlapping intervals, coverage, and distinct instruments.
- Longest common subsequence with missing sections, ASCII case differences, and empty sequences.
- PostgreSQL save/reload, annotation order, transaction rollback, Unicode and quoted strings, validation, and duplicate IDs.
- API search/filter/sort, details, recommendations, musical/structural comparison, health, and static frontend.
- Add/edit/delete/undo, persistent history, pending-job deduplication, FIFO processing, cancellation, and completed reports.
- JSON export/import, preservation of existing IDs, atomic rejection of invalid imports, and undo after import.
- Startup does not reinsert a deleted demo track.

## Launcher and browser

The all-in-one runner passed C tests, integration tests, launcher tests, and browser tests against an isolated PostgreSQL cluster. The launcher was restarted to verify that deletion persisted and undo restored the track afterward.

Headless Chrome checks passed for library search/filter/sort, timeline zoom and overlapping lanes, comparison, discovery, queue processing, three-step creation/editing, deletion/undo, import, page-reload persistence, network-error recovery, and dialog layout. No browser runtime exceptions were recorded. There was no document horizontal overflow at 390px or 320px viewport width.

Desktop and mobile screenshots were visually inspected. The final palette is ivory, charcoal, and muted sage. Screenshots are in `.local/screenshots`, with selected copies accompanying the release.

Finally, the real application database was launched with the final launcher, its health endpoint responded through C/libpq, all 15 existing tracks were present, and a JSON collection export plus PostgreSQL dump were saved. No test songs were added to that database. The release-check server and its owned database were stopped afterward.

## Verification boundaries

The Windows execution sandbox required database, API, and browser to share one process tree; `scripts/verify-all.mjs` handles that. Installed Edge crashed during sandbox automation, so the successful final run used installed Chrome with a separate test profile. Normal use does not require automation profiles or test flags.

The tests cover the local metadata/structure application. Audio streaming, automatic audio extraction, machine learning, multi-user authorization, and internet hosting are not implemented. This is not a load-test result or a formal accessibility audit.
