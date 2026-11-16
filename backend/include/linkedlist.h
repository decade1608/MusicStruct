#ifndef LINKEDLIST_H
#define LINKEDLIST_H

typedef struct Section
{
    char name[50];

    float startTime;
    float endTime;

    struct Section *next;

} Section;


/* Section functions */

Section *createSection(
    char name[],
    float startTime,
    float endTime
);

void addSection(
    Section **head,
    char name[],
    float startTime,
    float endTime
);

void displaySections(Section *head);

void freeSections(Section **head);

#endif