#include <stdio.h>
#include <string.h>
#include <math.h>

#include "../include/similarity.h"


/*
    Calculate similarity between two numerical values.

    Both values are assumed to be between 0.0 and 1.0.
*/
float featureSimilarity(float value1, float value2)
{
    float difference;

    difference = fabs(value1 - value2);

    return 1.0f - difference;
}


/*
    Calculate tempo similarity.

    Unlike other features, tempo is measured in BPM,
    so we normalize the difference relative to the larger tempo.
*/
float tempoSimilarity(float tempo1, float tempo2)
{
    float difference;
    float maximum;

    difference = fabs(tempo1 - tempo2);

    maximum = fmax(tempo1, tempo2);

    if (maximum == 0)
    {
        return 1.0f;
    }

    return 1.0f - (difference / maximum);
}


/*
    Calculate genre similarity.

    Same genre = 1.0
    Different genre = 0.0
*/
float genreSimilarity(char genre1[], char genre2[])
{
    if (strcmp(genre1, genre2) == 0)
    {
        return 1.0f;
    }

    return 0.0f;
}


/*
    Calculate overall song similarity.
*/
float calculateSimilarity(Song song1, Song song2)
{
    float tempoScore;
    float energyScore;
    float danceabilityScore;
    float valenceScore;
    float genreScore;

    float overallScore;


    tempoScore =
        tempoSimilarity(song1.tempo, song2.tempo);

    energyScore =
        featureSimilarity(song1.energy, song2.energy);

    danceabilityScore =
        featureSimilarity(
            song1.danceability,
            song2.danceability
        );

    valenceScore =
        featureSimilarity(
            song1.valence,
            song2.valence
        );

    genreScore =
        genreSimilarity(song1.genre, song2.genre);


    /*
        Weighted similarity.

        Tempo          = 25%
        Energy         = 20%
        Danceability   = 20%
        Valence        = 15%
        Genre          = 20%
    */

    overallScore =
        (tempoScore * 0.25f) +
        (energyScore * 0.20f) +
        (danceabilityScore * 0.20f) +
        (valenceScore * 0.15f) +
        (genreScore * 0.20f);


    return overallScore;
}


/*
    Display detailed similarity analysis.
*/
void displaySimilarity(Song song1, Song song2)
{
    float tempoScore;
    float energyScore;
    float danceabilityScore;
    float valenceScore;
    float genreScore;

    float overallScore;


    tempoScore =
        tempoSimilarity(song1.tempo, song2.tempo);

    energyScore =
        featureSimilarity(song1.energy, song2.energy);

    danceabilityScore =
        featureSimilarity(
            song1.danceability,
            song2.danceability
        );

    valenceScore =
        featureSimilarity(
            song1.valence,
            song2.valence
        );

    genreScore =
        genreSimilarity(song1.genre, song2.genre);


    overallScore =
        calculateSimilarity(song1, song2);


    printf("\n");
    printf("============================================\n");
    printf("          SONG SIMILARITY ANALYSIS\n");
    printf("============================================\n");

    printf("\nSong 1: %s", song1.title);
    printf("\nSong 2: %s\n", song2.title);

    printf("\n--------------------------------------------\n");

    printf("Tempo Similarity        : %.2f%%\n",
           tempoScore * 100);

    printf("Energy Similarity       : %.2f%%\n",
           energyScore * 100);

    printf("Danceability Similarity : %.2f%%\n",
           danceabilityScore * 100);

    printf("Valence Similarity      : %.2f%%\n",
           valenceScore * 100);

    printf("Genre Similarity        : %.2f%%\n",
           genreScore * 100);

    printf("--------------------------------------------\n");

    printf("Overall Similarity      : %.2f%%\n",
           overallScore * 100);

    printf("============================================\n");
}