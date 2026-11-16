#ifndef QUEUE_H
#define QUEUE_H

#include "song.h"

typedef struct QueueNode
{
    Song *song;

    struct QueueNode *next;

} QueueNode;


typedef struct
{
    QueueNode *front;
    QueueNode *rear;

} SongQueue;


/* Queue Functions */

void initializeQueue(SongQueue *queue);

int isQueueEmpty(SongQueue *queue);

void enqueue(SongQueue *queue, Song *song);

Song *dequeue(SongQueue *queue);

void displayQueue(SongQueue *queue);

void freeQueue(SongQueue *queue);

#endif