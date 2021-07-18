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

DROP FUNCTION IF EXISTS "createRepo" (_username TEXT, _repo TEXT, _branch TEXT, _url TEXT, _title TEXT, _description TEXT, _content TEXT);
CREATE FUNCTION "createRepo" (_username TEXT, _repo TEXT, _branch TEXT, _url TEXT, _title TEXT, _description TEXT, _content TEXT)
    RETURNS BOOLEAN
AS $$
BEGIN
    DELETE FROM "repo" WHERE "username" = _username AND "repo" = _repo AND "branch" = _branch;

    INSERT INTO "repo" ("createdAt", "username", "repo", "branch", "url", "title", "description", "content") VALUES(NOW(), _username, _repo, _branch, _url, _title, _description, _content);

    RETURN TRUE;
END; $$ LANGUAGE 'plpgsql';
