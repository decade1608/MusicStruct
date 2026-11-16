#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "../include/engine.h"
#include "../include/algorithms.h"
#include "../include/hashtable.h"
#include "../include/queue.h"

typedef struct {Song *songs;int count;HashTable index;PGresult *documents;} Library;
static int errorCode(PGresult *r){const char *c=PQresultErrorField(r,PG_DIAG_SQLSTATE);fprintf(stderr,"%s",PQresultErrorMessage(r));return c&&!strcmp(c,"23505")?3:c&&!strcmp(c,"P0002")?4:c&&!strcmp(c,"40001")?6:2;}
static PGresult *execute(PGconn *db,const char *sql,const char *data){const char *v[]={data};return data?PQexecParams(db,sql,1,NULL,v,NULL,NULL,0):PQexec(db,sql);}
static int output(PGconn *db,const char *sql,const char *data){PGresult *r=execute(db,sql,data);int rc=0;if(PQresultStatus(r)!=PGRES_TUPLES_OK && PQresultStatus(r)!=PGRES_COMMAND_OK)rc=errorCode(r);else if(PQntuples(r))puts(PQgetvalue(r,0,0));PQclear(r);return rc;}
static int command(PGconn *db,const char *sql){PGresult *r=PQexec(db,sql);int ok=PQresultStatus(r)==PGRES_COMMAND_OK||PQresultStatus(r)==PGRES_TUPLES_OK;if(!ok)errorCode(r);PQclear(r);return ok;}
static void release(Library *l){if(l->songs)for(int i=0;i<l->count;i++){freeSections(&l->songs[i].structure);freeComponents(&l->songs[i].components);}freeHashTable(&l->index);free(l->songs);if(l->documents)PQclear(l->documents);}
static int load(PGconn *db,Library *l){
 initializeHashTable(&l->index);
 l->documents=PQexec(db,"SELECT id,title,artist,album,genre,year,duration,tempo,energy,danceability,valence,to_jsonb(d) || COALESCE((SELECT jsonb_build_object('source',cs.details) FROM catalog_sources cs WHERE cs.song_id=d.id),'{}'::jsonb) FROM song_documents d ORDER BY id");
 if(PQresultStatus(l->documents)!=PGRES_TUPLES_OK)return 0;
 l->count=PQntuples(l->documents);l->songs=calloc((size_t)(l->count?l->count:1),sizeof *l->songs);if(!l->songs)return 0;
 for(int i=0;i<l->count;i++){
  Song *s=&l->songs[i];PGresult *r=l->documents;s->id=atoi(PQgetvalue(r,i,0));
  snprintf(s->title,sizeof s->title,"%s",PQgetvalue(r,i,1));snprintf(s->artist,sizeof s->artist,"%s",PQgetvalue(r,i,2));snprintf(s->album,sizeof s->album,"%s",PQgetvalue(r,i,3));snprintf(s->genre,sizeof s->genre,"%s",PQgetvalue(r,i,4));
  s->year=atoi(PQgetvalue(r,i,5));s->duration=atoi(PQgetvalue(r,i,6));s->tempo=strtof(PQgetvalue(r,i,7),NULL);s->energy=strtof(PQgetvalue(r,i,8),NULL);s->danceability=strtof(PQgetvalue(r,i,9),NULL);s->valence=strtof(PQgetvalue(r,i,10),NULL);
  if(insertSong(&l->index,s)!=1)return 0;
 }
 for(int type=0;type<2;type++){
  PGresult *r=PQexec(db,type?"SELECT song_id,name,start_time,end_time FROM song_components ORDER BY song_id,position":"SELECT song_id,name,start_time,end_time FROM song_sections ORDER BY song_id,position");
  if(PQresultStatus(r)!=PGRES_TUPLES_OK){PQclear(r);return 0;}
  for(int i=0;i<PQntuples(r);i++){
   Song *s=searchHashTable(&l->index,atoi(PQgetvalue(r,i,0)));if(!s)continue;
   char *name=PQgetvalue(r,i,1);float start=strtof(PQgetvalue(r,i,2),NULL),end=strtof(PQgetvalue(r,i,3),NULL);
   if(type){AudioComponent *c=createComponent(name,start,end);if(!c){PQclear(r);return 0;}AudioComponent **tail=&s->components;while(*tail)tail=&(*tail)->next;*tail=c;}
   else {Section *c=createSection(name,start,end);if(!c){PQclear(r);return 0;}Section **tail=&s->structure;while(*tail)tail=&(*tail)->next;*tail=c;}
  }PQclear(r);
 }return 1;
}
static const char *document(Library *l,Song *song){return PQgetvalue(l->documents,(int)(song-l->songs),11);}
static void report(const Song *song,char *out,size_t size){Arrangement a=inspectArrangement(song);snprintf(out,size,"{\"id\":%d,\"sections\":%d,\"clips\":%d,\"instruments\":%d,\"peakLayers\":%d,\"coveredSeconds\":%.3f,\"unannotatedSeconds\":%.3f,\"coverage\":%.6f,\"averageSection\":%.3f}",song->id,a.sections,a.clips,a.instruments,a.peak,a.covered,a.silence,a.covered/song->duration,a.average);}

/* The history journal is materialized as a linked stack. Only the top can be popped. */
typedef struct HistoryNode {char id[32];struct HistoryNode *next;} HistoryNode;
static int undo(PGconn *db){
 if(!command(db,"BEGIN")||!command(db,"SELECT pg_advisory_xact_lock(731902)"))return 2;
 PGresult *r=PQexec(db,"SELECT id FROM change_history WHERE undone_at IS NULL ORDER BY id");
 if(PQresultStatus(r)!=PGRES_TUPLES_OK){PQclear(r);command(db,"ROLLBACK");return 2;}
 HistoryNode *top=NULL;int rc=0;
 for(int i=0;i<PQntuples(r);i++){HistoryNode *node=malloc(sizeof *node);if(!node){rc=2;break;}snprintf(node->id,sizeof node->id,"%s",PQgetvalue(r,i,0));node->next=top;top=node;}
 PQclear(r);
 if(!rc)rc=top?output(db,"SELECT ms_undo($1::bigint)",top->id):4;
 while(top){HistoryNode *next=top->next;free(top);top=next;}
 if(!command(db,rc?"ROLLBACK":"COMMIT"))rc=2;
 return rc;
}
static int processQueue(PGconn *db){
 if(!command(db,"BEGIN")||!command(db,"SELECT pg_advisory_xact_lock(731902)"))return 2;
 Library l={0};SongQueue q;initializeQueue(&q);int rc=0;
 if(!load(db,&l)){rc=2;goto done;}
 PGresult *jobs=PQexec(db,"SELECT song_id FROM analysis_jobs WHERE status='pending' ORDER BY ticket");
 if(PQresultStatus(jobs)!=PGRES_TUPLES_OK){PQclear(jobs);rc=2;goto done;}
 for(int i=0;i<PQntuples(jobs);i++){Song *s=searchHashTable(&l.index,atoi(PQgetvalue(jobs,i,0)));if(s){QueueNode *old=q.rear;enqueue(&q,s);if(old==q.rear){rc=2;break;}}}
 PQclear(jobs);if(rc)goto done;
 Song *next=dequeue(&q);if(!next){puts("{\"empty\":true}");goto done;}
 char json[512];report(next,json,sizeof json);
 rc=output(db,"UPDATE analysis_jobs SET status='done',result=$1::jsonb,completed_at=now() WHERE song_id=($1::jsonb->>'id')::int AND status='pending' RETURNING result",json);
done:freeQueue(&q);release(&l);if(!command(db,rc?"ROLLBACK":"COMMIT"))rc=2;return rc;
}
static int rankCatalog(PGconn *db,const char *input){
 PGresult *r=execute(db,"SELECT id,tempo,LEAST(10000,GREATEST(1,($1::jsonb->>'limit')::int)) FROM songs WHERE id=($1::jsonb->>'sourceId')::int",input);
 if(PQresultStatus(r)!=PGRES_TUPLES_OK){int rc=errorCode(r);PQclear(r);return rc;}if(!PQntuples(r)){PQclear(r);return 4;}
 Song source={0};source.id=atoi(PQgetvalue(r,0,0));source.tempo=strtof(PQgetvalue(r,0,1),NULL);int limit=atoi(PQgetvalue(r,0,2));PQclear(r);
 r=execute(db,"SELECT to_jsonb(value->>'key')::text,(value->>'tempo')::real FROM jsonb_array_elements($1::jsonb->'candidates')",input);
 if(PQresultStatus(r)!=PGRES_TUPLES_OK){int rc=errorCode(r);PQclear(r);return rc;}int count=PQntuples(r);if(count>100000){PQclear(r);return 2;}
 Song *songs=calloc((size_t)(count?count:1),sizeof *songs);Match *matches=calloc((size_t)(limit?limit:1),sizeof *matches);if(!songs||!matches){free(songs);free(matches);PQclear(r);return 2;}
 for(int i=0;i<count;i++){songs[i].id=-(i+1);songs[i].tempo=strtof(PQgetvalue(r,i,1),NULL);if(!isfinite(songs[i].tempo)||songs[i].tempo<=0){free(songs);free(matches);PQclear(r);return 2;}}
 const double weights[5]={1,0,0,0,0};int found=topMatchesWeighted(songs,count,&source,limit,matches,weights);putchar('[');for(int i=0;i<found;i++){int index=(int)(matches[i].song-songs);printf("%s{\"key\":%s,\"score\":%.6f}",i?",":"",PQgetvalue(r,index,0),matches[i].score);}puts("]");free(songs);free(matches);PQclear(r);return 0;
}
int runEngine(PGconn *db,const char *op,const char *input){
 if(!strcmp(op,"catalog-rank"))return rankCatalog(db,input);
 if(!strcmp(op,"collections"))return output(db,"SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) FROM collection_documents p",NULL);
 if(!strcmp(op,"collection-mutate"))return output(db,"SELECT ms_collection($1::jsonb)",input);
 if(!strcmp(op,"catalog-cache"))return output(db,"SELECT ms_catalog_cache($1::jsonb)",input);
 if(!strcmp(op,"audio-attach"))return output(db,"SELECT ms_audio_attach($1::jsonb)",input);
 if(!strcmp(op,"audio-get"))return output(db,"SELECT COALESCE((SELECT to_jsonb(a) FROM song_audio a JOIN songs s ON s.id=a.song_id WHERE s.id=($1::jsonb->>'id')::int),'null'::jsonb)",input);
 if(!strcmp(op,"audio-detach"))return output(db,"WITH locked AS (SELECT pg_advisory_xact_lock(731902)), removed AS (DELETE FROM song_audio USING locked WHERE song_id=($1::jsonb->>'id')::int RETURNING asset_id) SELECT COALESCE((SELECT to_jsonb(r) FROM removed r),'null'::jsonb)",input);
 if(!strcmp(op,"playlist-save"))return output(db,"INSERT INTO saved_playlists(id,name,specification,result) VALUES(($1::jsonb->>'id')::uuid,$1::jsonb->>'name',$1::jsonb->'specification',$1::jsonb->'result') RETURNING to_jsonb(saved_playlists)",input);
 if(!strcmp(op,"playlist-list"))return output(db,"SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY created_at DESC),'[]') FROM saved_playlists p",NULL);
 if(!strcmp(op,"playlist-get"))return output(db,"SELECT COALESCE((SELECT to_jsonb(p) FROM saved_playlists p WHERE id=($1::jsonb->>'id')::uuid),'null'::jsonb)",input);
 if(!strcmp(op,"playlist-delete"))return output(db,"WITH removed AS(DELETE FROM saved_playlists WHERE id=($1::jsonb->>'id')::uuid RETURNING id) SELECT COALESCE((SELECT to_jsonb(r) FROM removed r),'null'::jsonb)",input);
 if(!strcmp(op,"seed-state"))return output(db,"SELECT jsonb_build_object('initialized',EXISTS(SELECT 1 FROM app_metadata WHERE key='demo_seeded'))",NULL);
 if(!strcmp(op,"seed-complete"))return output(db,"INSERT INTO app_metadata(key,value) VALUES('demo_seeded','true') ON CONFLICT(key) DO NOTHING",NULL);
 if(!strcmp(op,"edit"))return output(db,"SELECT ms_mutate('edit',$1::jsonb)",input);
 if(!strcmp(op,"create"))return output(db,"SELECT ms_mutate('add',$1::jsonb)",input);
 if(!strcmp(op,"delete"))return output(db,"SELECT ms_mutate('delete',$1::jsonb)",input);
 if(!strcmp(op,"import"))return output(db,"SELECT ms_import($1::jsonb)",input);
 if(!strcmp(op,"undo"))return undo(db);
 if(!strcmp(op,"history"))return output(db,"SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY id DESC),'[]') FROM (SELECT id,action,song_id,COALESCE(after_data->>'title',before_data->>'title') AS title,created_at FROM change_history WHERE undone_at IS NULL ORDER BY id DESC LIMIT 50) h",NULL);
 if(!strcmp(op,"enqueue"))return output(db,"WITH locked AS (SELECT pg_advisory_xact_lock(731902)), added AS (INSERT INTO analysis_jobs(song_id) SELECT ($1::jsonb->>'id')::int FROM locked ON CONFLICT(song_id) WHERE status='pending' DO NOTHING RETURNING ticket) SELECT jsonb_build_object('queued',true)",input);
 if(!strcmp(op,"queue"))return output(db,"SELECT COALESCE(jsonb_agg(to_jsonb(j) ORDER BY ticket),'[]') FROM (SELECT a.*,s.title,s.artist FROM analysis_jobs a JOIN songs s ON s.id=a.song_id WHERE status='pending' OR ticket IN (SELECT ticket FROM analysis_jobs WHERE status='done' ORDER BY ticket DESC LIMIT 20)) j",NULL);
 if(!strcmp(op,"process"))return processQueue(db);
 if(!strcmp(op,"cancel"))return output(db,"WITH locked AS (SELECT pg_advisory_xact_lock(731902)), deleted AS (DELETE FROM analysis_jobs USING locked WHERE ticket=($1::jsonb->>'ticket')::bigint AND status='pending' RETURNING ticket) SELECT jsonb_build_object('cancelled',EXISTS(SELECT 1 FROM deleted))",input);
 if(!command(db,"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"))return 2;
 Library l={0};int rc=0;PGresult *args=NULL;
 if(!load(db,&l)){rc=2;goto done;}
 args=execute(db,"SELECT COALESCE(($1::jsonb->>'id')::int,0),COALESCE($1::jsonb->>'q',''),COALESCE($1::jsonb->>'genre',''),COALESCE($1::jsonb->>'sort','title'),COALESCE(($1::jsonb->>'descending')::boolean,false),COALESCE(($1::jsonb->>'other')::int,0),COALESCE(($1::jsonb->'weights'->>'tempo')::float8,.25),COALESCE(($1::jsonb->'weights'->>'energy')::float8,.2),COALESCE(($1::jsonb->'weights'->>'danceability')::float8,.2),COALESCE(($1::jsonb->'weights'->>'valence')::float8,.15),COALESCE(($1::jsonb->'weights'->>'genre')::float8,.2),COALESCE(($1::jsonb->>'targetSeconds')::int,1800),COALESCE(($1::jsonb->>'maxTracks')::int,20)",input);
 if(PQresultStatus(args)!=PGRES_TUPLES_OK){rc=2;goto done;}
 double weights[5],sum=0;for(int i=0;i<5;i++){weights[i]=strtod(PQgetvalue(args,0,6+i),NULL);if(!isfinite(weights[i])||weights[i]<0){rc=2;goto done;}sum+=weights[i];}if(!isfinite(sum)||sum<=0){rc=2;goto done;}for(int i=0;i<5;i++)weights[i]/=sum;
 Song *song=searchHashTable(&l.index,atoi(PQgetvalue(args,0,0)));
 if(!strcmp(op,"catalog")){
  Song **matches=malloc((size_t)(l.count?l.count:1)*sizeof *matches);if(!matches){rc=2;goto done;}int n=0;
  for(int i=0;i<l.count;i++){char text[400];Song *s=&l.songs[i];snprintf(text,sizeof text,"%s %s %s %d",s->title,s->artist,s->album,s->id);int found=containsKMP(text,PQgetvalue(args,0,1));if(found<0){rc=2;break;}if(found && (!*PQgetvalue(args,0,2)||!strcmp(s->genre,PQgetvalue(args,0,2))))matches[n++]=s;}
  if(!rc && !sortSongs(matches,n,PQgetvalue(args,0,3),!strcmp(PQgetvalue(args,0,4),"t")))rc=2;
  if(!rc){putchar('[');for(int i=0;i<n;i++)printf("%s%s",i?",":"",document(&l,matches[i]));puts("]");}free(matches);
 }else if(!song)rc=4;
 else if(!strcmp(op,"weighted-compare")){
  Song *other=searchHashTable(&l.index,atoi(PQgetvalue(args,0,5)));if(!other){rc=4;goto done;}
  Arrangement a=inspectArrangement(song),b=inspectArrangement(other);int shared=sectionLCS(song,other);if(shared<0){rc=2;goto done;}
  printf("{\"score\":%.8f,\"features\":{\"tempo\":%.8f,\"energy\":%.8f,\"danceability\":%.8f,\"valence\":%.8f,\"genre\":%d},\"weights\":{\"tempo\":%.8f,\"energy\":%.8f,\"danceability\":%.8f,\"valence\":%.8f,\"genre\":%.8f},\"structure\":{\"sharedSections\":%d,\"sectionsA\":%d,\"sectionsB\":%d,\"score\":%.8f,\"available\":%s}}\n",
  weightedSimilarity(song,other,weights),1-fabsf(song->tempo-other->tempo)/fmaxf(song->tempo,other->tempo),1-fabsf(song->energy-other->energy),1-fabsf(song->danceability-other->danceability),1-fabsf(song->valence-other->valence),strcmp(song->genre,other->genre)==0,weights[0],weights[1],weights[2],weights[3],weights[4],shared,a.sections,b.sections,(a.sections+b.sections)?2.0*shared/(a.sections+b.sections):0,a.sections&&b.sections?"true":"false");
 }
 else if(!strcmp(op,"playlist")){
  int target=atoi(PQgetvalue(args,0,11)),limit=atoi(PQgetvalue(args,0,12));
  if(target<1||target>86400||limit<1||limit>100||song->duration>target){rc=2;goto done;}
  int *used=calloc((size_t)l.count,sizeof *used);if(!used){rc=2;goto done;}
  int total=song->duration,count=1;used[song-l.songs]=1;Song *previous=song;
  printf("{\"algorithm\":\"greedy-weighted-transitions\",\"targetSeconds\":%d,\"tracks\":[{\"song\":%s,\"transitionScore\":null}",target,document(&l,song));
  while(count<limit){int best=-1;float score=-1;for(int i=0;i<l.count;i++){if(used[i]||total+l.songs[i].duration>target)continue;float candidate=weightedSimilarity(previous,&l.songs[i],weights);if(candidate>score){score=candidate;best=i;}}if(best<0)break;used[best]=1;previous=&l.songs[best];total+=previous->duration;count++;printf(",{\"song\":%s,\"transitionScore\":%.8f}",document(&l,previous),score);}
  printf("],\"duration\":%d,\"unusedSeconds\":%d,\"optimal\":false}\n",total,target-total);free(used);
 }
 else if(!strcmp(op,"detail"))puts(document(&l,song));
 else if(!strcmp(op,"recommend")){
  Match matches[6];int n=topMatchesWeighted(l.songs,l.count,song,6,matches,weights);putchar('[');for(int i=0;i<n;i++)printf("%s{\"song\":%s,\"score\":%.8f}",i?",":"",document(&l,matches[i].song),matches[i].score);puts("]");
 }else if(!strcmp(op,"analyze")){char json[512];report(song,json,sizeof json);puts(json);}
 else if(!strcmp(op,"structure")){
  Song *other=searchHashTable(&l.index,atoi(PQgetvalue(args,0,5)));if(!other){rc=4;goto done;}
  Arrangement a=inspectArrangement(song),b=inspectArrangement(other);int shared=sectionLCS(song,other);if(shared<0){rc=2;goto done;}
  printf("{\"sharedSections\":%d,\"sectionsA\":%d,\"sectionsB\":%d,\"score\":%.8f,\"available\":%s}\n",shared,a.sections,b.sections,(a.sections+b.sections)?2.0*shared/(a.sections+b.sections):0,(a.sections&&b.sections)?"true":"false");
 }else rc=2;
done:if(args)PQclear(args);release(&l);if(!command(db,rc?"ROLLBACK":"COMMIT"))rc=2;return rc;
}
