# MusicStruct user guide

1. Launch `Start-MusicStruct.cmd` and open http://127.0.0.1:3000.
2. Choose a track in **Collection**. Search by title, artist, album, or ID. Genre and sort controls help narrow the list. Ctrl+K focuses search.
3. **The feeling** shows core features and the two closest related tracks. **The arrangement** shows sections and overlapping instrument clips. Zoom horizontally and select a clip to inspect its time.
4. Use the + beside two library tracks, then open **Compare tracks**. You can also choose both tracks from its dropdowns. Musical similarity and section-sequence similarity are separate measures.
5. **Discover** ranks six musical neighbours of the selected track. Selecting one returns to its collection details.
6. **Add track** walks through identity, features, and optional annotations. The pencil beside the selected title opens the same editor for changes. The form accepts overlapping clips as long as each has `0 ≤ start < end ≤ duration`.
7. **Queue analysis** adds the selected track to the persistent queue. In **Analysis queue**, **Process next** computes the oldest job's arrangement report. Pending jobs can be cancelled. Reports analyze metadata and annotations, not audio.
8. **Delete track** asks for confirmation. **History → Undo latest change** reverses additions, edits, and deletions from newest to oldest. Analysis jobs are cleared for restored tracks and can be regenerated.
9. **Export** downloads a JSON collection. **Import** accepts that file or a JSON array of song records. Existing IDs are preserved. Invalid records prevent the whole import. Keep exports outside the project folder as a backup.
10. Ctrl+C in the launcher stops the application. If it started PostgreSQL, it stops that database too. Your records remain stored on disk.

## A short demonstration

- Search for Midnight Circuit; inspect its energy and arrangement.
- Notice overlapping Pads clips on separate lanes.
- Compare Midnight Circuit with Paper Satellites.
- Open Discover and inspect the ranked neighbours.
- Queue two tracks and process them to demonstrate FIFO order.
- Edit a title, then undo it to demonstrate the history stack.
- Explain the C algorithm behind each action using Under the surface.

The synthetic examples make the project reproducible. Nothing in the interface claims to have listened to or extracted features from these tracks.
