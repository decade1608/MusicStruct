#ifndef SIMILARITY_H
#define SIMILARITY_H

#include "song.h"


/* Calculate similarity between two songs */

float calculateSimilarity(Song song1, Song song2);


/* Display detailed similarity analysis */

void displaySimilarity(Song song1, Song song2);

#endif