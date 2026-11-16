CREATE TABLE IF NOT EXISTS songs (
 id integer PRIMARY KEY CHECK (id > 0),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 99),
 artist text NOT NULL CHECK (length(trim(artist)) BETWEEN 1 AND 99),
 album text NOT NULL DEFAULT '' CHECK (length(album) <= 99),
 genre text NOT NULL CHECK (length(trim(genre)) BETWEEN 1 AND 49),
 year integer NOT NULL CHECK (year BETWEEN 0 AND 9999),
 duration integer NOT NULL CHECK (duration BETWEEN 1 AND 86400),
 tempo real NOT NULL CHECK (tempo > 0 AND tempo <= 400),
 energy real NOT NULL CHECK (energy BETWEEN 0 AND 1),
 danceability real NOT NULL CHECK (danceability BETWEEN 0 AND 1),
 valence real NOT NULL CHECK (valence BETWEEN 0 AND 1),
 acousticness real NOT NULL DEFAULT 0 CHECK (acousticness BETWEEN 0 AND 1),
 instrumentalness real NOT NULL DEFAULT 0 CHECK (instrumentalness BETWEEN 0 AND 1),
 speechiness real NOT NULL DEFAULT 0 CHECK (speechiness BETWEEN 0 AND 1),
 loudness real NOT NULL DEFAULT -12 CHECK (loudness BETWEEN -100 AND 10),
 musical_key integer NOT NULL DEFAULT 0 CHECK (musical_key BETWEEN 0 AND 11),
 time_signature integer NOT NULL DEFAULT 4 CHECK (time_signature BETWEEN 1 AND 16),
 synthetic boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS song_sections (
 song_id integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position >= 0),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 49),
 start_time real NOT NULL CHECK(start_time >= 0),
 end_time real NOT NULL CHECK(end_time > start_time AND end_time <= 86400),
 PRIMARY KEY(song_id, position)
);
CREATE TABLE IF NOT EXISTS song_components (
 song_id integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position >= 0),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 49),
 start_time real NOT NULL CHECK(start_time >= 0),
 end_time real NOT NULL CHECK(end_time > start_time AND end_time <= 86400),
 PRIMARY KEY(song_id, position)
);
CREATE OR REPLACE FUNCTION check_clip_duration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.end_time > (SELECT duration FROM songs WHERE id=NEW.song_id) THEN
   RAISE EXCEPTION 'Clip exceeds song duration' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS section_duration ON song_sections;
CREATE TRIGGER section_duration BEFORE INSERT OR UPDATE ON song_sections FOR EACH ROW EXECUTE FUNCTION check_clip_duration();
DROP TRIGGER IF EXISTS component_duration ON song_components;
CREATE TRIGGER component_duration BEFORE INSERT OR UPDATE ON song_components FOR EACH ROW EXECUTE FUNCTION check_clip_duration();
CREATE OR REPLACE VIEW song_documents AS
 SELECT s.*, COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'start',start_time,'end',end_time) ORDER BY position) FROM song_sections WHERE song_id=s.id),'[]'::jsonb) AS sections,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'start',start_time,'end',end_time) ORDER BY position) FROM song_components WHERE song_id=s.id),'[]'::jsonb) AS components FROM songs s;
