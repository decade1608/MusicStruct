#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <limits.h>
#include <string.h>
static int readInteger(int *out) {
 char line[128],*end;
 while(fgets(line,sizeof line,stdin)) {
  if(!strchr(line,'\n')&&!feof(stdin)){int c;while((c=getchar())!='\n'&&c!=EOF){} puts("Invalid integer. Try again:");continue;}
  errno=0;long n=strtol(line,&end,10);
  if(end==line){puts("Invalid integer. Try again:");continue;}
  while(*end==' '||*end=='\t'||*end=='\r'||*end=='\n')end++;
  if(!errno&&end!=line&&!*end&&n>=INT_MIN&&n<=INT_MAX){*out=(int)n;return 1;}
  puts("Invalid integer. Try again:");
 }return 0;
}

#include "../include/song.h"
#include "../include/similarity.h"
#include "../include/hashtable.h"
#include "../include/queue.h"


int main()
{
    Song songs[MAX_SONGS];

    int songCount = 0;
    int choice;

    HashTable hashTable;
    SongQueue analysisQueue;

    initializeHashTable(&hashTable);
    initializeQueue(&analysisQueue);

    printf("\n");
    printf("============================================\n");
    printf("       MUSIC STRUCTURE ANALYZER\n");
    printf("============================================\n");


    do
    {
        printf("\n");
        printf("============== MAIN MENU ================\n");

        printf("1. Add Song\n");
        printf("2. Display All Songs\n");
        printf("3. Search Song\n");
        printf("4. Compare Two Songs\n");
        printf("5. Hash Table Search\n");
        printf("6. Display Hash Table\n");
        printf("7. Add Song to Analysis Queue\n");
        printf("8. Process Next Song\n");
        printf("9. Display Analysis Queue\n");
        printf("10. Exit\n");

        printf("==========================================\n");

        printf("Enter your choice: ");
        if (!readInteger(&choice)) break;


        switch (choice)
        {
            case 1:
            {
                int oldCount;

                oldCount = songCount;

                addSong(songs, &songCount);


                /*
                    If a new song was successfully added,
                    insert it into the hash table.
                */

                if (songCount > oldCount)
                {
                    int result;

                    result = insertSong(
                        &hashTable,
                        &songs[songCount - 1]
                    );


                    if (result == 1)
                    {
                        printf("Song added to Hash Table successfully.\n");
                    }
                    else if (result == 0)
                    {
                        printf("Duplicate Song ID detected.\n");
                    }
                    else
                    {
                        printf("Could not insert song into Hash Table.\n");
                    }
                }

                break;
            }


            case 2:
            {
                displayAllSongs(songs, songCount);
                break;
            }


            case 3:
            {
                int id;

                printf("\nEnter Song ID to search: ");
                if (!readInteger(&id)) { choice = 10; break; }

                int result = searchSongById(
                    songs,
                    songCount,
                    id
                );


                if (result != -1)
                {
                    printf("\nSong Found!\n");

                    displaySong(songs[result]);
                }
                else
                {
                    printf("\nSong not found.\n");
                }

                break;
            }

            case 4:
            {
                int id1;
                int id2;

                int result1;
                int result2;


                printf("\nEnter first Song ID: ");
                if (!readInteger(&id1)) { choice = 10; break; }

                printf("Enter second Song ID: ");
                if (!readInteger(&id2)) { choice = 10; break; }


                result1 = searchSongById(
                    songs,
                    songCount,
                    id1
                );

                result2 = searchSongById(
                    songs,
                    songCount,
                    id2
                );


                if (result1 == -1 || result2 == -1)
                {
                    printf("\nOne or both songs were not found.\n");
                }
                else
                {
                    displaySimilarity(
                        songs[result1],
                        songs[result2]
                    );
                }

                break;
            }

            case 5:
            {
                int id;

                Song *foundSong;


                printf("\nEnter Song ID to search: ");
                if (!readInteger(&id)) { choice = 10; break; }


                foundSong = searchHashTable(
                    &hashTable,
                    id
                );


                if (foundSong != NULL)
                {
                    printf("\nSong Found using Hash Table!\n");

                    displaySong(*foundSong);
                }
                else
                {
                    printf("\nSong not found.\n");
                }

                break;
            }

            case 6:
            {
                displayHashTable(&hashTable);

                break;
            }

            case 7:
            {
                int id;

                Song *foundSong;


                printf("\nEnter Song ID to add to analysis queue: ");
                if (!readInteger(&id)) { choice = 10; break; }


                foundSong = searchHashTable(
                    &hashTable,
                    id
                );


                if (foundSong != NULL)
                {
                    enqueue(
                        &analysisQueue,
                        foundSong
                    );

                    printf(
                        "\n%s added to analysis queue.\n",
                        foundSong->title
                    );
                }
                else
                {
                    printf("\nSong not found.\n");
                }

                break;
            }

            case 8:
            {
                Song *songToAnalyze;


                songToAnalyze = dequeue(
                    &analysisQueue
                );


                if (songToAnalyze == NULL)
                {
                    printf("\nNo songs waiting for analysis.\n");
                }
                else
                {
                    printf("\nProcessing song...\n");

                    printf(
                        "Analyzing: %s - %s\n",
                        songToAnalyze->title,
                        songToAnalyze->artist
                    );


                    printf("\nAnalysis completed.\n");

                    displaySong(*songToAnalyze);
                }

                break;
            }

            case 9:
            {
                displayQueue(&analysisQueue);

                break;
            }

            case 10:
            {
                printf("\nThank you for using Music Structure Analyzer!\n");
                break;
            }


            default:
            {
                printf("\nInvalid choice. Please try again.\n");
            }
        }

    } while (choice != 10);

    for (int i = 0; i < songCount; i++)
    {
        freeSections(&songs[i].structure);
        freeComponents(&songs[i].components);
    }

    freeHashTable(&hashTable);

    freeQueue(&analysisQueue);

    return 0;
}