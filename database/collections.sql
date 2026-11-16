CREATE TABLE IF NOT EXISTS catalog_sources (
 song_id integer PRIMARY KEY, provider_key text UNIQUE NOT NULL, details jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS collections (
 id uuid PRIMARY KEY, name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120), created_at timestamptz NOT NULL DEFAULT now()
);
-- Stable IDs preserve membership when song edit/undo recreates its database row.
CREATE TABLE IF NOT EXISTS collection_tracks (
 playlist_id uuid REFERENCES collections(id) ON DELETE CASCADE,
 song_id integer NOT NULL, position integer NOT NULL,
 PRIMARY KEY(playlist_id,song_id)
);
CREATE OR REPLACE VIEW collection_documents AS
 SELECT p.*, COALESCE((SELECT jsonb_agg(jsonb_build_object('song',to_jsonb(d) || COALESCE((SELECT jsonb_build_object('source',cs.details) FROM catalog_sources cs WHERE cs.song_id=d.id),'{}'::jsonb),'playable',EXISTS(SELECT 1 FROM song_audio a WHERE a.song_id=d.id)) ORDER BY t.position,t.song_id) FROM collection_tracks t JOIN song_documents d ON d.id=t.song_id WHERE t.playlist_id=p.id),'[]'::jsonb) AS tracks FROM collections p;
CREATE OR REPLACE FUNCTION ms_collection(d jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE pid uuid:=(d->>'id')::uuid; operation text:=d->>'operation'; result jsonb; sid integer; added integer:=0; total integer;
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 IF operation='create' THEN INSERT INTO collections(id,name) VALUES(pid,trim(d->>'name'));
 ELSE
  IF NOT EXISTS(SELECT 1 FROM collections WHERE id=pid) THEN RAISE EXCEPTION 'Playlist missing' USING ERRCODE='P0002'; END IF;
  IF operation='rename' THEN UPDATE collections SET name=trim(d->>'name') WHERE id=pid;
  ELSIF operation='delete' THEN DELETE FROM collections WHERE id=pid;RETURN jsonb_build_object('deleted',true);
  ELSIF operation='add' THEN
   sid:=(d->>'songId')::int;
   IF NOT EXISTS(SELECT 1 FROM songs WHERE id=sid) THEN RAISE EXCEPTION 'Song missing' USING ERRCODE='P0002'; END IF;
   INSERT INTO collection_tracks VALUES(pid,sid,COALESCE((SELECT max(position)+1 FROM collection_tracks WHERE playlist_id=pid),0)) ON CONFLICT DO NOTHING;
  ELSIF operation='remove' THEN DELETE FROM collection_tracks WHERE playlist_id=pid AND song_id=(d->>'songId')::int;
  ELSIF operation='queue' THEN
   SELECT count(*) INTO total FROM collection_tracks t JOIN songs s ON s.id=t.song_id WHERE playlist_id=pid;
   FOR sid IN SELECT t.song_id FROM collection_tracks t JOIN songs s ON s.id=t.song_id WHERE playlist_id=pid ORDER BY position,t.song_id LOOP
    IF NOT EXISTS(SELECT 1 FROM analysis_jobs WHERE song_id=sid AND status='pending') THEN
     INSERT INTO analysis_jobs(song_id) VALUES(sid);added:=added+1;
    END IF;
   END LOOP;
   RETURN jsonb_build_object('added',added,'skipped',total-added,'total',total);
  ELSE RAISE EXCEPTION 'Invalid operation'; END IF;
 END IF;
 SELECT to_jsonb(p) INTO result FROM collection_documents p WHERE id=pid;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION ms_catalog_cache(d jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE sid integer; doc jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(731902);
 SELECT song_id INTO sid FROM catalog_sources WHERE provider_key=d->>'key';
 IF sid IS NULL THEN
  SELECT s.id INTO sid FROM songs s WHERE s.title=d->'song'->>'title' AND s.artist=d->'song'->>'artist' AND NOT EXISTS(SELECT 1 FROM catalog_sources cs WHERE cs.song_id=s.id) ORDER BY s.id LIMIT 1;
  IF sid IS NULL THEN
   SELECT GREATEST(10000,COALESCE((SELECT max(id) FROM songs),0),COALESCE((SELECT max(song_id) FROM change_history),0),COALESCE((SELECT max(song_id) FROM song_audio),0),COALESCE((SELECT max(song_id) FROM catalog_sources),0))+1 INTO sid;
   doc:=(d->'song')||jsonb_build_object('id',sid);PERFORM ms_mutate('add',doc);
  END IF;
  INSERT INTO catalog_sources VALUES(sid,d->>'key',d->'source');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM songs WHERE id=sid) THEN RAISE EXCEPTION 'Imported song was deleted; undo its deletion first' USING ERRCODE='P0002'; END IF;
 SELECT to_jsonb(s)||jsonb_build_object('source',cs.details) INTO doc FROM song_documents s JOIN catalog_sources cs ON cs.song_id=s.id WHERE s.id=sid; RETURN doc;
END $$;
