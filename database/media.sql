-- Attachments use stable song IDs without cascade: edit/delete/undo recreates song rows.
-- Reads always join live songs. Deletion retains the attachment for undo.
CREATE TABLE IF NOT EXISTS song_audio (
 song_id integer PRIMARY KEY,
 asset_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name)<=200),
 mime text NOT NULL,
 bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 104857600),
 sha256 text NOT NULL CHECK(length(sha256)=64),
 analysis jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION ms_audio_attach(d jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE old uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 IF NOT EXISTS(SELECT 1 FROM songs WHERE id=(d->>'id')::int) THEN RAISE EXCEPTION 'Song missing' USING ERRCODE='P0002'; END IF;
 SELECT asset_id INTO old FROM song_audio WHERE song_id=(d->>'id')::int;
 INSERT INTO song_audio(song_id,asset_id,name,mime,bytes,sha256,analysis)
 VALUES((d->>'id')::int,(d->>'asset_id')::uuid,d->>'name',d->>'mime',(d->>'bytes')::int,d->>'sha256',d->'analysis')
 ON CONFLICT(song_id) DO UPDATE SET asset_id=EXCLUDED.asset_id,name=EXCLUDED.name,mime=EXCLUDED.mime,bytes=EXCLUDED.bytes,sha256=EXCLUDED.sha256,analysis=EXCLUDED.analysis,updated_at=now();
 RETURN jsonb_build_object('saved',true,'previous_asset',old);
END $$;
CREATE TABLE IF NOT EXISTS saved_playlists (
 id uuid PRIMARY KEY,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 specification jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
