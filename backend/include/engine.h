#ifndef ENGINE_H
#define ENGINE_H
#include <libpq-fe.h>
int runEngine(PGconn *db,const char *command,const char *input);
#endif
