#ifndef HASHTABLE_H
#define HASHTABLE_H

#include "song.h"

#define TABLE_SIZE 101


typedef struct HashNode
{
    Song *song;

    struct HashNode *next;

} HashNode;


typedef struct
{
    HashNode *table[TABLE_SIZE];

} HashTable;


/* Hash Table Functions */

void initializeHashTable(HashTable *hashTable);

int hashFunction(int id);

int insertSong(HashTable *hashTable, Song *song);

Song *searchHashTable(HashTable *hashTable, int id);

void displayHashTable(HashTable *hashTable);

void freeHashTable(HashTable *hashTable);

#endif