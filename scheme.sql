DROP TABLE IF EXISTS "repo";
CREATE TABLE "repo" (
    "id" SERIAL PRIMARY KEY,
    "createdAt" timestamp,
    "username" VARCHAR(255),
    "repo" VARCHAR(255),
    "branch" VARCHAR(255),
    "url" VARCHAR(255),
    "title" VARCHAR(255),
    "description" VARCHAR(255),
    "content" TEXT
);
