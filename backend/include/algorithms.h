#ifndef ALGORITHMS_H
#define ALGORITHMS_H
#include "song.h"
typedef struct { Song *song; float score; } Match;
typedef struct { int sections, clips, instruments, peak; float covered, silence, average; } Arrangement;
int containsKMP(const char *text, const char *pattern);
int sortSongs(Song **items, int count, const char *key, int descending);
float weightedSimilarity(const Song *a, const Song *b, const double weights[5]);
int topMatchesWeighted(Song *songs, int count, const Song *source, int k, Match *out, const double weights[5]);
int topMatches(Song *songs, int count, const Song *source, int k, Match *out);
Arrangement inspectArrangement(const Song *song);
int sectionLCS(const Song *a, const Song *b);
#endif
