#ifndef COMPONENT_H
#define COMPONENT_H

typedef struct AudioComponent
{
    char type[50];

    float startTime;
    float endTime;

    struct AudioComponent *next;

} AudioComponent;


AudioComponent *createComponent(
    char type[],
    float startTime,
    float endTime
);

void addComponent(
    AudioComponent **head,
    char type[],
    float startTime,
    float endTime
);

void displayComponents(AudioComponent *head);

void freeComponents(AudioComponent **head);

#endif