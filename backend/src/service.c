/* JSON command adapter. All database access and similarity scoring remain in C. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <libpq-fe.h>
#include "../include/song.h"
#include "../include/similarity.h"
#include "../include/hashtable.h"
#include "../include/engine.h"

static PGconn *db;
static int query(const char *sql, const char *value, int print) {
    const char *values[] = {value};
    PGresult *r = value ? PQexecParams(db,sql,1,NULL,values,NULL,NULL,0) : PQexec(db,sql);
    ExecStatusType status=PQresultStatus(r);
    if(status!=PGRES_COMMAND_OK && status!=PGRES_TUPLES_OK) {
        const char *code=PQresultErrorField(r,PG_DIAG_SQLSTATE);
        fprintf(stderr,"%s\n",PQresultErrorMessage(r));
        int rc=code && strcmp(code,"23505")==0 ? 3 : 2;
        PQclear(r); return rc;
    }
    if(print && PQntuples(r)>0) puts(PQgetvalue(r,0,0));
    PQclear(r); return 0;
}
static char *input(void) {
    char *data=calloc(4194306,1); if(!data) return NULL;
    size_t n=fread(data,1,4194305,stdin);
    if(n>4194304 || ferror(stdin)) {free(data);return NULL;} data[n]=0;return data;
}
static int add(const char *data) {
    int rc=query("BEGIN",NULL,0); if(rc) return rc;
    rc=query("WITH j AS (SELECT $1::jsonb AS d) INSERT INTO songs "
      "SELECT (d->>'id')::int,d->>'title',d->>'artist',COALESCE(d->>'album',''),d->>'genre',(d->>'year')::int,(d->>'duration')::int,"
      "(d->>'tempo')::real,(d->>'energy')::real,(d->>'danceability')::real,(d->>'valence')::real,"
      "COALESCE((d->>'acousticness')::real,0),COALESCE((d->>'instrumentalness')::real,0),COALESCE((d->>'speechiness')::real,0),"
      "COALESCE((d->>'loudness')::real,-12),COALESCE((d->>'musical_key')::int,0),COALESCE((d->>'time_signature')::int,4),COALESCE((d->>'synthetic')::boolean,false) FROM j",data,0);
    if(!rc) rc=query("INSERT INTO song_sections SELECT ($1::jsonb->>'id')::int,(ord-1)::int,x->>'name',(x->>'start')::real,(x->>'end')::real FROM jsonb_array_elements(COALESCE($1::jsonb->'sections','[]')) WITH ORDINALITY AS t(x,ord)",data,0);
    if(!rc) rc=query("INSERT INTO song_components SELECT ($1::jsonb->>'id')::int,(ord-1)::int,x->>'name',(x->>'start')::real,(x->>'end')::real FROM jsonb_array_elements(COALESCE($1::jsonb->'components','[]')) WITH ORDINALITY AS t(x,ord)",data,0);
    if(rc) {query("ROLLBACK",NULL,0);return rc;}
    rc=query("COMMIT",NULL,0); if(!rc) puts("{\"saved\":true}");return rc;
}
static int compare(const char *a,const char *b) {
    const char *values[]={a,b};
    PGresult *r=PQexecParams(db,"SELECT id,tempo,energy,danceability,valence,genre FROM songs WHERE id=$1::int OR id=$2::int ORDER BY id",2,NULL,values,NULL,NULL,0);
    if(PQresultStatus(r)!=PGRES_TUPLES_OK) {PQclear(r);return 2;}
    Song songs[2]={{0}}; HashTable table; initializeHashTable(&table);
    for(int i=0;i<PQntuples(r);i++) {
        songs[i].id=atoi(PQgetvalue(r,i,0)); songs[i].tempo=strtof(PQgetvalue(r,i,1),NULL);
        songs[i].energy=strtof(PQgetvalue(r,i,2),NULL); songs[i].danceability=strtof(PQgetvalue(r,i,3),NULL);
        songs[i].valence=strtof(PQgetvalue(r,i,4),NULL); snprintf(songs[i].genre,sizeof songs[i].genre,"%s",PQgetvalue(r,i,5));
        if(insertSong(&table,&songs[i])!=1) {PQclear(r);freeHashTable(&table);return 2;}
    }
    PQclear(r); Song *x=searchHashTable(&table,atoi(a)),*y=searchHashTable(&table,atoi(b));
    if(!x || !y) {freeHashTable(&table);return 4;}
    printf("{\"score\":%.8f,\"features\":{\"tempo\":%.8f,\"energy\":%.8f,\"danceability\":%.8f,\"valence\":%.8f,\"genre\":%d},\"weights\":{\"tempo\":0.25,\"energy\":0.2,\"danceability\":0.2,\"valence\":0.15,\"genre\":0.2}}\n",
        calculateSimilarity(*x,*y),1-fabsf(x->tempo-y->tempo)/fmaxf(x->tempo,y->tempo),1-fabsf(x->energy-y->energy),1-fabsf(x->danceability-y->danceability),1-fabsf(x->valence-y->valence),strcmp(x->genre,y->genre)==0);
    freeHashTable(&table);return 0;
}
int main(int argc,char **argv) {
    if(argc<2) {fprintf(stderr,"Commands: health, init, list, add, compare ID ID\n");return 2;}
    const char *connection=getenv("MUSICSTRUCT_DATABASE_URL");
    db=PQconnectdb(connection ? connection : "host=127.0.0.1 port=55432 dbname=musicstruct user=musicstruct connect_timeout=5");
    if(PQstatus(db)!=CONNECTION_OK) {fprintf(stderr,"Database connection failed: %s",PQerrorMessage(db));PQfinish(db);return 5;}
    PQsetClientEncoding(db,"UTF8"); int rc=2;
    if(strcmp(argv[1],"health")==0) rc=query("SELECT '{\"database\":\"connected\",\"backend\":\"C / libpq\"}'",NULL,1);
    else if(strcmp(argv[1],"list")==0) rc=query("SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY id),'[]'::jsonb) FROM song_documents d",NULL,1);
    else if(strcmp(argv[1],"compare")==0 && argc==4) rc=compare(argv[2],argv[3]);
    else if(strcmp(argv[1],"add")==0 || strcmp(argv[1],"init")==0) {
        char *data=input(); if(data) {rc=strcmp(argv[1],"add")==0 ? add(data) : query(data,NULL,0);free(data);}
    }
    else { char *data=input(); if(data){rc=runEngine(db,argv[1],*data?data:"{}");free(data);} }
    PQfinish(db);return rc;
}
