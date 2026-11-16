#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include "../include/algorithms.h"
#include "../include/similarity.h"

/* KMP substring search: ASCII case-insensitive, UTF-8 byte-exact otherwise. */
static unsigned char fold(unsigned char c) { return c<128?(unsigned char)tolower(c):c; }
int containsKMP(const char *text,const char *pattern) {
    size_t m=strlen(pattern); if(!m)return 1;
    size_t *prefix=calloc(m,sizeof *prefix); if(!prefix)return -1;
    for(size_t i=1,j=0;i<m;i++) {
        while(j && fold((unsigned char)pattern[i])!=fold((unsigned char)pattern[j]))j=prefix[j-1];
        if(fold((unsigned char)pattern[i])==fold((unsigned char)pattern[j]))j++;
        prefix[i]=j;
    }
    for(size_t i=0,j=0;text[i];i++) {
        while(j && fold((unsigned char)text[i])!=fold((unsigned char)pattern[j]))j=prefix[j-1];
        if(fold((unsigned char)text[i])==fold((unsigned char)pattern[j]))j++;
        if(j==m){free(prefix);return 1;}
    }
    free(prefix);return 0;
}
static int titleCompare(const char *a,const char *b) {
    while(*a && *b && fold((unsigned char)*a)==fold((unsigned char)*b)){a++;b++;}
    return (int)fold((unsigned char)*a)-(int)fold((unsigned char)*b);
}
static int songCompare(const Song *a,const Song *b,const char *key,int descending) {
    int c;
    if(!strcmp(key,"tempo"))c=(a->tempo>b->tempo)-(a->tempo<b->tempo);
    else if(!strcmp(key,"energy"))c=(a->energy>b->energy)-(a->energy<b->energy);
    else if(!strcmp(key,"duration"))c=(a->duration>b->duration)-(a->duration<b->duration);
    else if(!strcmp(key,"recent"))c=(a->id<b->id)-(a->id>b->id);
    else c=titleCompare(a->title,b->title);
    return descending?-c:c;
}
static void merge(Song **a,Song **tmp,int lo,int hi,const char *key,int desc) {
    if(hi-lo<2)return;
    int mid=lo+(hi-lo)/2;merge(a,tmp,lo,mid,key,desc);merge(a,tmp,mid,hi,key,desc);
    int i=lo,j=mid,k=lo;
    while(i<mid && j<hi)tmp[k++]=songCompare(a[i],a[j],key,desc)<=0?a[i++]:a[j++];
    while(i<mid)tmp[k++]=a[i++];
    while(j<hi)tmp[k++]=a[j++];
    for(i=lo;i<hi;i++)a[i]=tmp[i];
}
int sortSongs(Song **a,int count,const char *key,int descending) {
    Song **tmp=malloc((size_t)(count?count:1)*sizeof *tmp);if(!tmp)return 0;
    merge(a,tmp,0,count,key,descending);free(tmp);return 1;
}
/* A bounded min-heap retains only k candidates. Equal scores prefer lower IDs. */
static int worse(Match a,Match b){return a.score<b.score || (a.score==b.score && a.song->id>b.song->id);}
static void down(Match *heap,int n,int i) {
    for(;;){int child=2*i+1;if(child>=n)break;if(child+1<n && worse(heap[child+1],heap[child]))child++;
        if(!worse(heap[child],heap[i]))break;
        Match t=heap[i];heap[i]=heap[child];heap[child]=t;i=child;
    }
}
int topMatchesWeighted(Song *songs,int count,const Song *source,int k,Match *out,const double weights[5]) {
    int n=0;if(k<=0)return 0;
    for(int i=0;i<count;i++) {
        if(songs[i].id==source->id)continue;
        Match item={&songs[i],weightedSimilarity(source,&songs[i],weights)};
        if(n<k){int j=n++;out[j]=item;while(j>0){int parent=(j-1)/2;if(!worse(out[j],out[parent]))break;Match t=out[j];out[j]=out[parent];out[parent]=t;j=parent;}}
        else if(worse(out[0],item)){out[0]=item;down(out,n,0);}
    }
    /* Heap-sort produces descending score order without sorting the whole library. */
    for(int end=n-1;end>0;end--){Match t=out[0];out[0]=out[end];out[end]=t;down(out,end,0);}
    return n;
}
typedef struct {float time;int delta;} Event;
static int eventCompare(const void *a,const void *b){const Event *x=a,*y=b;if(x->time!=y->time)return (x->time>y->time)-(x->time<y->time);return x->delta-y->delta;}
Arrangement inspectArrangement(const Song *song) {
    Arrangement a={0};float sum=0;
    for(Section *s=song->structure;s;s=s->next){a.sections++;sum+=s->endTime-s->startTime;}
    a.average=a.sections?sum/a.sections:0;
    for(AudioComponent *c=song->components;c;c=c->next){a.clips++;int seen=0;for(AudioComponent *p=song->components;p!=c;p=p->next)if(!strcmp(c->type,p->type)){seen=1;break;}if(!seen)a.instruments++;}
    Event *events=malloc((size_t)(a.clips?a.clips*2:1)*sizeof *events);
    if(!events){a.peak=-1;return a;}
    int i=0;for(AudioComponent *c=song->components;c;c=c->next){events[i++]=(Event){c->startTime,1};events[i++]=(Event){c->endTime,-1};}
    qsort(events,(size_t)i,sizeof *events,eventCompare);
    int active=0;float last=0;
    for(int j=0;j<i;j++){if(active>0)a.covered+=events[j].time-last;active+=events[j].delta;if(active>a.peak)a.peak=active;last=events[j].time;}
    a.silence=fmaxf(0,song->duration-a.covered);free(events);return a;
}
/* Longest common subsequence of section labels; O(m*n) time and O(n) memory. */
int sectionLCS(const Song *a,const Song *b) {
    int n=0;for(Section *s=b->structure;s;s=s->next)n++;
    int *row=calloc((size_t)n+1,sizeof *row);if(!row)return -1;
    for(Section *x=a->structure;x;x=x->next){int j=1,diagonal=0;for(Section *y=b->structure;y;y=y->next,j++){int old=row[j];if(!titleCompare(x->name,y->name))row[j]=diagonal+1;else if(row[j-1]>row[j])row[j]=row[j-1];diagonal=old;}}
    int result=row[n];free(row);return result;
}

float weightedSimilarity(const Song *a,const Song *b,const double w[5]) {
 const double defaults[5]={.25,.2,.2,.15,.2};if(!w)w=defaults;
 double sum=0,score=0;double features[5]={1-fabs(a->tempo-b->tempo)/fmax(a->tempo,b->tempo),1-fabs(a->energy-b->energy),1-fabs(a->danceability-b->danceability),1-fabs(a->valence-b->valence),strcmp(a->genre,b->genre)==0};
 for(int i=0;i<5;i++){if(!isfinite(w[i])||w[i]<0)return -1;sum+=w[i];score+=w[i]*features[i];}
 return sum>0?(float)(score/sum):-1;
}
int topMatches(Song *songs,int count,const Song *source,int k,Match *out){return topMatchesWeighted(songs,count,source,k,out,NULL);}
