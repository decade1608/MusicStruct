import {backend} from '../api/server.mjs';
import {readFile} from 'node:fs/promises';
await backend(['init'],await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
await backend(['init'],await readFile(new URL('../database/workflows.sql',import.meta.url),'utf8'));
await backend(['init'],await readFile(new URL('../database/media.sql',import.meta.url),'utf8'));
await backend(['init'],await readFile(new URL('../database/collections.sql',import.meta.url),'utf8'));
const state=await backend(['seed-state']);
if(!state.initialized){
 const existing=new Set((await backend(['list'])).map(s=>s.id));
 const songs=process.env.MUSICSTRUCT_SEED_DEMOS==='1'?JSON.parse(await readFile(new URL('../backend/data/demo.json',import.meta.url),'utf8')):[];
 let added=0;for(const song of songs){if(!existing.has(song.id)){await backend(['add'],JSON.stringify(song));added++;}}
 await backend(['seed-complete']);
 console.log(`Initial demo import: ${added} added; existing IDs preserved.`);
}else console.log('Collection ready. Existing edits and deletions preserved.');

await backend(['init'],`BEGIN; SELECT pg_advisory_xact_lock(731902); INSERT INTO collections(id,name) SELECT '11111111-1111-4111-8111-111111111111','My music' WHERE NOT EXISTS(SELECT 1 FROM app_metadata WHERE key='collections-initialized') ON CONFLICT DO NOTHING; INSERT INTO collection_tracks SELECT '11111111-1111-4111-8111-111111111111',id,row_number() OVER(ORDER BY id)::int FROM songs WHERE NOT synthetic AND NOT EXISTS(SELECT 1 FROM app_metadata WHERE key='collections-initialized') ON CONFLICT DO NOTHING; INSERT INTO app_metadata VALUES('collections-initialized','true') ON CONFLICT DO NOTHING; COMMIT;`);
