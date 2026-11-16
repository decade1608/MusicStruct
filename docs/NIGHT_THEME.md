# Night theme and analytics — 15 November 2026

The frontend uses the supplied near-black, plum, burgundy, violet and magenta palette. Native CSS gradients and slowly moving background shapes require no external assets or animation library. Motion can be switched off in the desktop sidebar and respects the device's reduced-motion preference. Mobile layouts use a compact player with expandable Track tools.

Analytics includes stored tempo versus duration, genre counts, tempo/duration rankings and annotation counts. Genre filtering, point selection, keyboard selection and a chart-data table are available. The overview has a tempo gauge and supplied-feature bars. Unmeasured mood defaults on the licensed starter recordings are excluded from plotted feature profiles. Charts are not a claim of automatic MP3 analysis or listening-history analysis.

Spotify is an external search shortcut only. It opens https://open.spotify.com/search/ with the typed query; it does not fetch a catalog, import tracks, authenticate an account or play Spotify streams. MusicStruct plays local licensed recordings and user uploads without a subscription. Spotify SDK full-track playback requires Premium: https://developer.spotify.com/documentation/web-playback-sdk/tutorials/getting-started . No Spotify content is analysed.

Verification: Vite production build passed. Disposable-database browser suite passed playback, session recovery, uploads, playlists, existing CRUD/import/undo workflows, analytics counts/filter/selection/metric changes, Spotify URL construction and reduced-motion behavior. Overflow checks passed at 320px and 390px; desktop and phone screenshots were inspected. Logs: .local/night-verification.log. User database and audio were not changed by this redesign.

Update, 16 November 2026: the external Spotify shortcut has been replaced with in-app freely licensed catalog search and editable playlists. See docs/COLLECTIONS.md.
