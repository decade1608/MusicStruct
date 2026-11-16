CREATE TABLE IF NOT EXISTS app_metadata (
 key text PRIMARY KEY,
 value jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS change_history (
 id bigserial PRIMARY KEY,
 action text NOT NULL CHECK(action IN ('add','edit','delete')),
 song_id integer NOT NULL,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 undone_at timestamptz
);
CREATE TABLE IF NOT EXISTS analysis_jobs (
 ticket bigserial PRIMARY KEY,
 song_id integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_job ON analysis_jobs(song_id) WHERE status='pending';

CREATE OR REPLACE FUNCTION ms_write_document(d jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v songs;
BEGIN
 v := jsonb_populate_record(NULL::songs, '{"album":"","acousticness":0,"instrumentalness":0,"speechiness":0,"loudness":-12,"musical_key":0,"time_signature":4,"synthetic":false}'::jsonb || d);
 IF octet_length(v.title)>99 OR octet_length(v.artist)>99 OR octet_length(v.album)>99 OR octet_length(v.genre)>49 THEN
  RAISE EXCEPTION 'Text exceeds C field capacity' USING ERRCODE='23514';
 END IF;
 IF jsonb_array_length(COALESCE(d->'sections','[]'))>200 OR jsonb_array_length(COALESCE(d->'components','[]'))>200 THEN
  RAISE EXCEPTION 'Too many annotations' USING ERRCODE='23514';
 END IF;
 INSERT INTO songs SELECT v.*;
 INSERT INTO song_sections SELECT v.id,(ord-1)::int,x->>'name',(x->>'start')::real,(x->>'end')::real FROM jsonb_array_elements(COALESCE(d->'sections','[]')) WITH ORDINALITY t(x,ord);
 INSERT INTO song_components SELECT v.id,(ord-1)::int,x->>'name',(x->>'start')::real,(x->>'end')::real FROM jsonb_array_elements(COALESCE(d->'components','[]')) WITH ORDINALITY t(x,ord);
 IF EXISTS(SELECT 1 FROM song_sections WHERE song_id=v.id AND octet_length(name)>49) OR EXISTS(SELECT 1 FROM song_components WHERE song_id=v.id AND octet_length(name)>49) THEN
  RAISE EXCEPTION 'Annotation label exceeds C field capacity' USING ERRCODE='23514';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION ms_mutate(operation text,d jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE old jsonb; sid integer := (d->>'id')::integer;
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 SELECT to_jsonb(s) INTO old FROM song_documents s WHERE id=sid;
 IF operation NOT IN ('add','edit','delete') THEN RAISE EXCEPTION 'Invalid operation'; END IF;
 IF operation='add' AND old IS NOT NULL THEN RAISE EXCEPTION 'Duplicate ID' USING ERRCODE='23505'; END IF;
 -- A deleted track's audio is retained for undo; never attach it to a new record.
 IF operation='add' AND to_regclass('song_audio') IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM song_audio WHERE song_id=sid) THEN
   RAISE EXCEPTION 'ID reserved by retained audio; undo the deletion and detach audio before reusing it' USING ERRCODE='23505';
  END IF;
 END IF;
 IF operation<>'add' AND old IS NULL THEN RAISE EXCEPTION 'Song not found' USING ERRCODE='P0002'; END IF;
 IF operation<>'add' THEN DELETE FROM songs WHERE id=sid; END IF;
 IF operation<>'delete' THEN PERFORM ms_write_document(d); END IF;
 INSERT INTO change_history(action,song_id,before_data,after_data) VALUES(operation,sid,old,CASE WHEN operation='delete' THEN NULL ELSE d END);
 RETURN jsonb_build_object('saved',true,'id',sid,'action',operation);
END $$;

CREATE OR REPLACE FUNCTION ms_undo(history_id bigint) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE h change_history;
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 SELECT * INTO h FROM change_history WHERE undone_at IS NULL ORDER BY id DESC LIMIT 1;
 IF h.id IS NULL THEN RAISE EXCEPTION 'Nothing to undo' USING ERRCODE='P0002'; END IF;
 IF h.id<>history_id THEN RAISE EXCEPTION 'History changed, retry undo' USING ERRCODE='40001'; END IF;
 DELETE FROM songs WHERE id=h.song_id;
 IF h.before_data IS NOT NULL THEN PERFORM ms_write_document(h.before_data); END IF;
 UPDATE change_history SET undone_at=now() WHERE id=h.id;
 RETURN jsonb_build_object('undone',h.action,'id',h.song_id);
END $$;

CREATE OR REPLACE FUNCTION ms_import(documents jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d jsonb; added integer:=0; skipped integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 FOR d IN SELECT value FROM jsonb_array_elements(documents) LOOP
  IF EXISTS(SELECT 1 FROM songs WHERE id=(d->>'id')::int) THEN skipped:=skipped+1;
  ELSE PERFORM ms_mutate('add',d);added:=added+1; END IF;
 END LOOP;
 RETURN jsonb_build_object('added',added,'skipped',skipped);
END $$;
