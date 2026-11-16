#ifndef SONG_H
#define SONG_H

#include "linkedlist.h"
#include "component.h"

#define MAX_SONGS 500

typedef struct
{
    /* Basic song information */
    int id;

    char title[100];
    char artist[100];
    char album[100];
    char genre[50];

    int year;
    int duration;

    /* Musical features */
    float tempo;
    float energy;
    float danceability;
    float valence;

    float acousticness;
    float instrumentalness;
    float speechiness;
    float loudness;

    int musicalKey;
    int timeSignature;

    /* Song structure */
    Section *structure;
    AudioComponent *components;

} Song;


/* Song functions */

void addSong(Song songs[], int *songCount);

void displaySong(Song song);

void displayAllSongs(Song songs[], int songCount);

int searchSongById(
    Song songs[],
    int songCount,
    int id
);

#endif