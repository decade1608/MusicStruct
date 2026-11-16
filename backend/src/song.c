#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <math.h>
#include <errno.h>
#include "../include/song.h"
static int line(const char *label,char *out,size_t size,int optional) {
    printf("%s",label);
    if(!fgets(out,(int)size,stdin)) return 0;
    size_t n=strcspn(out,"\r\n");
    if(out[n]==0 && !feof(stdin)) {int c;while((c=getchar())!='\n' && c!=EOF){} puts("Input too long.");return 0;}
    out[n]=0; if(!optional && n==0) {puts("A value is required.");return 0;}return 1;
}
static int number(const char *label,double min,double max,int integer,double *out) {
    char text[128],*end; if(!line(label,text,sizeof text,0)) return 0;
    errno=0;double value=strtod(text,&end);while(*end==' '||*end=='\t')end++;
    if(errno || *end || !isfinite(value) || value<min || value>max || (integer && floor(value)!=value)) {puts("Invalid numeric value. Song was not added.");return 0;}
    *out=value;return 1;
}
void addSong(Song songs[],int *songCount) {
    if(*songCount>=MAX_SONGS) {puts("Library is full.");return;}
    Song s={0};double n;s.timeSignature=4;s.loudness=-12;
    if(!number("Song ID: ",1,2147483647,1,&n))return;
    s.id=(int)n;
    if(searchSongById(songs,*songCount,s.id)!=-1){puts("Duplicate song ID.");return;}
    if(!line("Title: ",s.title,sizeof s.title,0)||!line("Artist: ",s.artist,sizeof s.artist,0)||!line("Genre: ",s.genre,sizeof s.genre,0)||!line("Album: ",s.album,sizeof s.album,1))return;
    if(!number("Year: ",0,9999,1,&n))return;
    s.year=(int)n;
    if(!number("Duration (seconds): ",1,86400,1,&n))return;
    s.duration=(int)n;
    if(!number("Tempo (BPM): ",0.01,400,0,&n))return;
    s.tempo=(float)n;
    if(!number("Energy (0-1): ",0,1,0,&n))return;
    s.energy=(float)n;
    if(!number("Danceability (0-1): ",0,1,0,&n))return;
    s.danceability=(float)n;
    if(!number("Valence (0-1): ",0,1,0,&n))return;
    s.valence=(float)n;
    for(int type=0;type<2;type++) {
        if(!number(type?"Number of instrument clips: ":"Number of sections: ",0,200,1,&n))goto fail;
        int count=(int)n;
        for(int i=0;i<count;i++) {char name[50];double start,end;
            if(!line("Clip name: ",name,sizeof name,0)||!number("Start: ",0,s.duration,0,&start)||!number("End: ",0,s.duration,0,&end)||end<=start)goto fail;
            if(type){AudioComponent *c=createComponent(name,(float)start,(float)end);if(!c)goto fail;AudioComponent **tail=&s.components;while(*tail)tail=&(*tail)->next;*tail=c;}
            else {Section *c=createSection(name,(float)start,(float)end);if(!c)goto fail;Section **tail=&s.structure;while(*tail)tail=&(*tail)->next;*tail=c;}
        }
    }
    songs[(*songCount)++]=s;puts("Song added to terminal session.");return;
fail:freeSections(&s.structure);freeComponents(&s.components);puts("Invalid annotation. Song was not added.");
}

/* Display one song */

void displaySong(Song song)
{
    printf("\n----------------------------------------\n");

    printf("Song ID       : %d\n", song.id);
    printf("Title         : %s\n", song.title);
    printf("Artist        : %s\n", song.artist);
    printf("Genre         : %s\n", song.genre);
    printf("Album         : %s\n", song.album);

    printf("Release Year  : %d\n", song.year);
    printf("Duration      : %d seconds\n", song.duration);

    printf("Tempo         : %.2f BPM\n", song.tempo);
    printf("Energy        : %.2f\n", song.energy);
    printf("Danceability  : %.2f\n", song.danceability);
    printf("Valence       : %.2f\n", song.valence);

    displaySections(song.structure);
    displayComponents(song.components);

    printf("----------------------------------------\n");
}


/* Display all songs */

void displayAllSongs(Song songs[], int songCount)
{
    if (songCount == 0)
    {
        printf("\nNo songs available in the library.\n");
        return;
    }

    printf("\n========== SONG LIBRARY ==========\n");

    for (int i = 0; i < songCount; i++)
    {
        displaySong(songs[i]);
    }
}


/* Search song by ID */

int searchSongById(Song songs[], int songCount, int id)
{
    for (int i = 0; i < songCount; i++)
    {
        if (songs[i].id == id)
        {
            return i;
        }
    }

    return -1;
}
