#include <stdio.h>
#include <stdlib.h>

#include "../include/queue.h"


/*
    Initialize Queue
*/
void initializeQueue(SongQueue *queue)
{
    queue->front = NULL;
    queue->rear = NULL;
}


/*
    Check whether Queue is empty
*/
int isQueueEmpty(SongQueue *queue)
{
    if (queue->front == NULL)
    {
        return 1;
    }

    return 0;
}


/*
    Add a song to the rear of the Queue
*/
void enqueue(SongQueue *queue, Song *song)
{
    QueueNode *newNode;


    newNode = (QueueNode *)malloc(sizeof(QueueNode));

    if (newNode == NULL)
    {
        printf("Memory allocation failed!\n");
        return;
    }


    newNode->song = song;
    newNode->next = NULL;


    /*
        If queue is empty,
        both front and rear point to new node.
    */

    if (queue->rear == NULL)
    {
        queue->front = newNode;
        queue->rear = newNode;

        return;
    }


    /*
        Otherwise add to rear.
    */

    queue->rear->next = newNode;

    queue->rear = newNode;
}


/*
    Remove a song from the front
*/
Song *dequeue(SongQueue *queue)
{
    QueueNode *temp;
    Song *song;


    if (isQueueEmpty(queue))
    {
        return NULL;
    }


    temp = queue->front;

    song = temp->song;

    queue->front = queue->front->next;


    /*
        If queue becomes empty,
        rear must also become NULL.
    */

    if (queue->front == NULL)
    {
        queue->rear = NULL;
    }


    free(temp);

    return song;
}


/*
    Display songs currently waiting in Queue
*/
void displayQueue(SongQueue *queue)
{
    QueueNode *current;


    if (isQueueEmpty(queue))
    {
        printf("\nAnalysis Queue is empty.\n");
        return;
    }


    printf("\n");
    printf("============================================\n");
    printf("             ANALYSIS QUEUE\n");
    printf("============================================\n");


    current = queue->front;


    while (current != NULL)
    {
        printf(
            "Song ID: %d | %s - %s\n",
            current->song->id,
            current->song->title,
            current->song->artist
        );

        current = current->next;
    }


    printf("============================================\n");
}


/*
    Free remaining Queue nodes
*/
void freeQueue(SongQueue *queue)
{
    QueueNode *current;
    QueueNode *temp;


    current = queue->front;


    while (current != NULL)
    {
        temp = current;

        current = current->next;

        free(temp);
    }


    queue->front = NULL;
    queue->rear = NULL;
}