#include <stdio.h>
#include <stdlib.h>

#include "../include/hashtable.h"


/*
    Hash Function

    Converts a Song ID into a table index.
*/
int hashFunction(int id)
{
    int remainder = id % TABLE_SIZE;
    return remainder < 0 ? -remainder : remainder;
}


/*
    Initialize Hash Table
*/
void initializeHashTable(HashTable *hashTable)
{
    for (int i = 0; i < TABLE_SIZE; i++)
    {
        hashTable->table[i] = NULL;
    }
}


/*
    Insert a Song into the Hash Table
*/
int insertSong(HashTable *hashTable, Song *song)
{
    int index;

    HashNode *newNode;
    HashNode *current;


    index = hashFunction(song->id);


    /*
        Check whether this ID already exists.
    */

    current = hashTable->table[index];

    while (current != NULL)
    {
        if (current->song->id == song->id)
        {
            return 0;
        }

        current = current->next;
    }


    /*
        Create new hash node.
    */

    newNode = (HashNode *)malloc(sizeof(HashNode));

    if (newNode == NULL)
    {
        printf("Memory allocation failed!\n");
        return -1;
    }


    newNode->song = song;


    /*
        Insert at beginning of linked chain.
    */

    newNode->next = hashTable->table[index];

    hashTable->table[index] = newNode;


    return 1;
}


/*
    Search Song using Hash Table
*/
Song *searchHashTable(HashTable *hashTable, int id)
{
    int index;

    HashNode *current;


    index = hashFunction(id);

    current = hashTable->table[index];


    while (current != NULL)
    {
        if (current->song->id == id)
        {
            return current->song;
        }

        current = current->next;
    }


    return NULL;
}


/*
    Display Hash Table
*/
void displayHashTable(HashTable *hashTable)
{
    HashNode *current;

    printf("\n");
    printf("============================================\n");
    printf("              HASH TABLE\n");
    printf("============================================\n");


    for (int i = 0; i < TABLE_SIZE; i++)
    {
        if (hashTable->table[i] != NULL)
        {
            printf("\nIndex %d: ", i);

            current = hashTable->table[i];

            while (current != NULL)
            {
                printf(
                    "[ID: %d | %s]",
                    current->song->id,
                    current->song->title
                );

                if (current->next != NULL)
                {
                    printf(" -> ");
                }

                current = current->next;
            }
        }
    }

    printf("\n");
    printf("============================================\n");
}


/*
    Free Hash Table memory
*/
void freeHashTable(HashTable *hashTable)
{
    HashNode *current;
    HashNode *temp;


    for (int i = 0; i < TABLE_SIZE; i++)
    {
        current = hashTable->table[i];


        while (current != NULL)
        {
            temp = current;

            current = current->next;

            free(temp);
        }


        hashTable->table[i] = NULL;
    }
}
