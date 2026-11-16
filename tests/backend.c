#include <assert.h>
#include <limits.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "../backend/include/song.h"
#include "../backend/include/hashtable.h"
#include "../backend/include/queue.h"
#include "../backend/include/similarity.h"
#include "../backend/include/algorithms.h"
int main(void){
 Song a={0},b={0}; a.id=INT_MIN;b.id=42;a.tempo=b.tempo=120;a.energy=b.energy=.5f;a.danceability=b.danceability=.6f;a.valence=b.valence=.7f;
 strcpy(a.genre,"Jazz");strcpy(b.genre,"Jazz");
 assert(fabsf(calculateSimilarity(a,b)-1)<.00001f);
 b.tempo=60;b.energy=0;b.danceability=0;b.valence=0;strcpy(b.genre,"Pop");
 assert(fabsf(calculateSimilarity(a,b)-.35f)<.00001f);
 assert(fabsf(calculateSimilarity(a,b)-calculateSimilarity(b,a))<.00001f);
 HashTable h;initializeHashTable(&h);assert(hashFunction(INT_MIN)>=0);assert(insertSong(&h,&a)==1);assert(insertSong(&h,&a)==0);assert(searchHashTable(&h,INT_MIN)==&a);assert(searchHashTable(&h,3)==NULL);freeHashTable(&h);
 SongQueue q;initializeQueue(&q);enqueue(&q,&a);enqueue(&q,&b);assert(dequeue(&q)==&a);assert(dequeue(&q)==&b);assert(isQueueEmpty(&q));assert(dequeue(&q)==NULL);freeQueue(&q);
 addSection(&a.structure,"Intro",0,10);addSection(&a.structure,"Verse",10,30);assert(strcmp(a.structure->next->name,"Verse")==0);freeSections(&a.structure);assert(!a.structure);
 addComponent(&a.components,"Piano",0,20);addComponent(&a.components,"Piano",10,30);assert(a.components->next->startTime==10);freeComponents(&a.components);assert(!a.components);
 char label[200];memset(label,'x',199);label[199]=0;Section *s=createSection(label,0,1);assert(strlen(s->name)==49);freeSections(&s);
 Song songs[]={a,b};assert(searchSongById(songs,2,42)==1);assert(searchSongById(songs,2,17)==-1);
 assert(containsKMP("ababababac","ababac")==1);assert(containsKMP("MiDnight Circuit","NIGHT")==1);assert(containsKMP("music","")==1);assert(!containsKMP("music","musics"));
 Song candidates[20]={{0}};Song *order[20];
 for(int i=0;i<20;i++){candidates[i]=a;candidates[i].id=i+1;candidates[i].tempo=60+i*5;snprintf(candidates[i].title,sizeof candidates[i].title,"Track %02d",19-i);order[i]=&candidates[i];}
 assert(sortSongs(order,20,"title",0));assert(!strcmp(order[0]->title,"Track 00"));assert(sortSongs(order,20,"tempo",1));assert(order[0]->tempo==155);
 Match matches[6];int matched=topMatches(candidates,20,&candidates[5],6,matches);assert(matched==6);
 for(int i=0;i<6;i++){assert(matches[i].song->id!=6);if(i)assert(matches[i-1].score>=matches[i].score);}
 for(int i=0;i<20;i++)if(candidates[i].id!=6){int included=0;for(int j=0;j<6;j++)if(matches[j].song==&candidates[i])included=1;if(!included)assert(calculateSimilarity(candidates[5],candidates[i])<=matches[5].score);}
 a.duration=30;addComponent(&a.components,"Piano",0,10);addComponent(&a.components,"Piano",10,20);Arrangement report=inspectArrangement(&a);assert(report.peak==1&&report.covered==20&&report.silence==10&&report.instruments==1);
 addComponent(&a.components,"Bass",5,15);report=inspectArrangement(&a);assert(report.peak==2&&report.covered==20&&report.instruments==2);freeComponents(&a.components);
 addSection(&a.structure,"Intro",0,5);addSection(&a.structure,"Verse",5,10);addSection(&a.structure,"Chorus",10,20);addSection(&b.structure,"intro",0,5);addSection(&b.structure,"Chorus",5,20);assert(sectionLCS(&a,&b)==2);freeSections(&a.structure);freeSections(&b.structure);assert(sectionLCS(&a,&b)==0);
 puts("PASS: similarity, hash, FIFO, lists, linear/KMP search, merge sort, bounded heap, sweep-line overlap, LCS");return 0;
}
