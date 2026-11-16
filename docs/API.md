# HTTP API

Base address: `http://127.0.0.1:3000/api`. Responses are JSON. Error bodies contain `error`. Write bodies use `Content-Type: application/json`. Cross-origin writes are rejected. This is a loopback-only, single-user application.

| Method | Route | Operation |
| --- | --- | --- |
| GET | `/health` | C/libpq database connectivity |
| GET | `/songs?q=&genre=&sort=&descending=` | C KMP filtering and merge sorting |
| GET | `/songs/:id` | Hash-indexed song document |
| POST | `/songs` | Create a song and journal the addition |
| PUT | `/songs/:id` | Replace metadata/annotations; IDs cannot change |
| DELETE | `/songs/:id` | Delete and journal a recoverable snapshot |
| GET | `/songs/:id/recommendations` | Top six other tracks from a bounded heap |
| GET | `/songs/:id/analysis` | C arrangement report |
| GET | `/compare?a=:id&b=:id` | Musical score, breakdown, weights, and LCS structure score |
| GET | `/queue` | Pending jobs plus the 20 most recent completed jobs |
| POST | `/queue` | Enqueue `{ "id": 1 }`; pending duplicates are ignored |
| POST | `/queue/process` | Process oldest pending job; returns `empty` when clear |
| DELETE | `/queue/:ticket` | Cancel a pending job |
| GET | `/history` | Latest 50 active changes |
| POST | `/undo` | Undo newest active change |
| GET | `/export` | Download versioned JSON collection |
| POST | `/import` | Atomic import of an array or `{ "songs": [...] }`; skip existing IDs |

Sort keys: `title`, `tempo`, `energy`, `duration`, `recent` (descending song ID). Default is title ascending.

## Record example

```json
{
  "id": 101,
  "title": "Quiet Morning",
  "artist": "Example Artist",
  "album": "",
  "genre": "Ambient",
  "year": 2026,
  "duration": 180,
  "tempo": 90,
  "energy": 0.3,
  "danceability": 0.4,
  "valence": 0.6,
  "acousticness": 0.7,
  "instrumentalness": 0.9,
  "speechiness": 0.02,
  "loudness": -14,
  "musical_key": 0,
  "time_signature": 4,
  "synthetic": false,
  "sections": [{"name":"Intro","start":0,"end":20}],
  "components": [{"name":"Piano","start":0,"end":180}]
}
```

ID is a positive signed 32-bit integer. Duration is an integer from 1 to 86,400 seconds; tempo is 0.01–400 BPM; normalized features are 0–1; key is 0–11; time-signature numerator is 1–16. Each annotation array supports 200 clips. Title/artist/album limits are 99 UTF-8 bytes and genre/annotation labels 49 bytes, matching the C fields. Album and the additional features have defaults. Import limits are 1,000 records and 2 MB.

Typical errors: 400 invalid data, 404 missing record/nothing to undo, 409 duplicate ID or concurrent history change, 413 oversized input, 415 wrong content type, 503 database/backend unavailable. Database commands use parameterized queries; song/annotation/history mutations are transactional.
