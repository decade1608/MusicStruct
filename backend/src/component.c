#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../include/component.h"


AudioComponent *createComponent(
    char type[],
    float startTime,
    float endTime
)
{
    AudioComponent *newComponent;

    newComponent = (AudioComponent *)malloc(
        sizeof(AudioComponent)
    );

    if (newComponent == NULL)
    {
        printf("Memory allocation failed!\n");
        return NULL;
    }

    snprintf(newComponent->type, sizeof newComponent->type, "%s", type);

    newComponent->startTime = startTime;
    newComponent->endTime = endTime;

    newComponent->next = NULL;

    return newComponent;
}


void addComponent(
    AudioComponent **head,
    char type[],
    float startTime,
    float endTime
)
{
    AudioComponent *newComponent;
    AudioComponent *temp;

    newComponent = createComponent(
        type,
        startTime,
        endTime
    );

    if (newComponent == NULL)
        return;

    if (*head == NULL)
    {
        *head = newComponent;
        return;
    }

    temp = *head;

    while (temp->next != NULL)
        temp = temp->next;

    temp->next = newComponent;
}


void displayComponents(AudioComponent *head)
{
    AudioComponent *temp;

    if (head == NULL)
    {
        printf("\nNo audio components available.\n");
        return;
    }

    printf("\nAudio Components:\n");

    temp = head;

    while (temp != NULL)
    {
        printf(
            "[%s: %.1f - %.1f sec]",
            temp->type,
            temp->startTime,
            temp->endTime
        );

        if (temp->next != NULL)
            printf(" -> ");

        temp = temp->next;
    }

    printf("\n");
}


void freeComponents(AudioComponent **head)
{
    AudioComponent *temp;

    while (*head != NULL)
    {
        temp = *head;

        *head = (*head)->next;

        free(temp);
    }
}
