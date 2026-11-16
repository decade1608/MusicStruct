# Local player — first frontend phase

Implemented: persistent player across app navigation; native accessible play/pause, seek and volume controls; attach/replace WAV, MP3 and M4A on a selected song; metadata-only and synthetic labels; measured WAV summary; listening queue with deduplication, reordering, removal, previous/next, shuffle and repeat-current.

Select a library record and use Attach audio at the bottom of the page. Uploads stay attached across restarts. Uploading does not change the record's supplied duration, tempo or other features. Browser codec support determines MP3/M4A playback. Replacing the currently playing file pauses it. The listening queue, playback position, shuffle and repeat settings are saved in this browser. Refresh restores available tracks paused, without autoplay. Browser storage must be enabled. Deleted or unavailable tracks are skipped.

Next phases: bulk audio import and tags, then Spotify feasibility. No Spotify integration has been added.

Run scripts/start.ps1 from a non-administrator terminal and keep it open. Refresh an already-running app to load the rebuilt frontend.

## Waveform, arrangement and smart playlists

The player renders the currently loaded WAV's measured peak waveform. Its overlaid seek slider supports pointer and keyboard input. Selecting an arrangement clip or timeline position seeks that song's attachment; switching to another song this way loads it paused. Annotation times beyond the measured audio duration are clamped. Metadata-only tracks display an attach-audio message.

Build a smart playlist opens a time-budget, maximum-track and five-weight editor. Preview does not save. Generate & save stores a snapshot through the C backend. Saved snapshots can be reopened or deleted. Load playable tracks into queue preserves the planned order, skips missing/deleted/unattached songs, reports the count, and does not autoplay. Duration is based on song metadata, which can differ from attached audio. Plans are deterministic greedy results, not guaranteed optimal routes.

Browser checks cover waveform and arrangement seeking, preview/save/reopen/delete, and queue filtering, alongside the existing playback and responsive-layout checks.
