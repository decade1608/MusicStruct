#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../include/linkedlist.h"


Section *createSection(
    char name[],
    float startTime,
    float endTime
)
{
    Section *newSection;

    newSection = (Section *)malloc(sizeof(Section));

    if (newSection == NULL)
    {
        printf("Memory allocation failed!\n");
        return NULL;
    }

    snprintf(newSection->name, sizeof newSection->name, "%s", name);

    newSection->startTime = startTime;
    newSection->endTime = endTime;

    newSection->next = NULL;

    return newSection;
}


void addSection(
    Section **head,
    char name[],
    float startTime,
    float endTime
)
{
    Section *newSection;
    Section *temp;

    newSection = createSection(
        name,
        startTime,
        endTime
    );

    if (newSection == NULL)
        return;

    if (*head == NULL)
    {
        *head = newSection;
        return;
    }

    temp = *head;

    while (temp->next != NULL)
        temp = temp->next;

    temp->next = newSection;
}


void displaySections(Section *head)
{
    Section *temp;

    if (head == NULL)
    {
        printf("No song structure available.\n");
        return;
    }

    printf("\nSong Structure:\n");

    temp = head;

    while (temp != NULL)
    {
        printf(
            "[%s: %.1f - %.1f sec]",
            temp->name,
            temp->startTime,
            temp->endTime
        );

        if (temp->next != NULL)
            printf(" -> ");

        temp = temp->next;
    }

    printf("\n");
}


void freeSections(Section **head)
{
    Section *temp;

    while (*head != NULL)
    {
        temp = *head;

        *head = (*head)->next;

        free(temp);
    }
}
