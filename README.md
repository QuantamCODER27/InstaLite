# InstaLite — CRUD, lists, and relations

Express 5, Prisma 7, PostgreSQL, and CommonJS. Implements all three labs, including the bonus liked-posts endpoint. Routes connect to controllers; controllers validate requests and call services; services contain Prisma queries and never access Express request/response objects.

## Start locally

Requires Node.js 20.19+ (Node 24 recommended).

```sh
npm install
npm run prisma:generate
npm run db:start
```

Leave the database terminal running. In another terminal, from this project directory:

```sh
npm run db:migrate
npm run seed
npm start
```

The server listens at `http://localhost:3000`; `/health` returns `{ "status": "OK" }`. `npm run dev` enables Node's watcher. The local database is persistent, named `instalite-relations`, and separate from the previous lab's `instalite` database. `db:start` saves its direct and shadow connection URLs in `.env` and sets a single-connection pool for PGlite. Normal PostgreSQL uses ten connections by default; `PG_POOL_MAX` overrides that.

For an existing PostgreSQL installation, set `DATABASE_URL` in `.env` to its direct `postgresql://` URL and skip `db:start`. `DIRECT_DATABASE_URL`, when set, takes precedence. The pg adapter cannot use `prisma+postgres://`. `SHADOW_DATABASE_URL` is optional for deployment and necessary when a local development server cannot create separate shadow databases. `prisma.config.ts` registers seeding; `prisma7.config.ts` forwards to it for compatibility.

## Migrations and seeding

The migrations are the original schema, `add_post_author`, and `add_likes`. There were no schema changes for Phase 2. Apply the full history to an empty development database with `npm run db:migrate`.

A populated Phase 2 database cannot apply the author migration: every existing post would receive NULL in the new required `authorId`. The demonstrated `migrate dev --create-only` warning reported 24 such rows. Use a new development database, backfill valid authors as part of a deliberate data migration, or explicitly reset a disposable development database before applying the migration. The local launcher uses a separate database to preserve the previous lab's data. Do not reset production data.

Any of these commands runs the registered seed:

```sh
node prisma/seed.js
npx prisma db seed
npm run seed
```

Seeding replaces likes, posts, then users inside a transaction. The fixed fixtures produce **12 users, 24 posts, and 29 likes** on every run. Bulk inserts return real generated IDs; username and insta## lookups link authors and likes. IDs increase across runs. The printed counts come from query results. A failed seed rolls back and exits with status 1; the CLI always disconnects.

## API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /health | Server health |
| POST | /users | Required username, email, fullname; optional bio |
| GET | /users | Paginated, sorted, filtered users |
| GET | /users/:id | User and `_count: { posts, likes }` (likes given) |
| PATCH | /users/:id | Edit fullname, bio, isPrivate |
| DELETE | /users/:id | Delete user, their posts, and affected likes; empty 204 |
| GET | /users/:id/posts | Paginated authored posts with like counts |
| GET | /users/:id/liked-posts | Paginated liked posts with authors and like counts |
| POST | /posts | Required imageUrl and authorId; optional caption, location |
| GET | /posts | Paginated posts with authors and like counts |
| GET | /posts/:id | Post with author and like count |
| PATCH | /posts/:id | Edit caption and location; ignore imageUrl and authorId |
| DELETE | /posts/:id | Delete post and its likes; empty 204 |
| GET | /posts/:id/likes | Username-sorted array of public user summaries |
| POST | /posts/:id/likes | Required userId; create like, or 409 Already liked |
| DELETE | /posts/:id/likes/:userId | Unlike; empty 204, or 404 Like not found |

Nested users always contain only `{ id, username, fullname }`. Usernames, emails, IDs, timestamps, and post ownership cannot be edited through PATCH. Unknown body fields are ignored. Nullable text fields can be cleared with null. This remains a lab backend without authentication.

## List queries

All four paginated endpoints return:

```json
{ "data": [], "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 } }
```

`page` defaults to 1, `limit` to 10; both must be positive integers. Limits are capped at 50. Beyond the last page, data is empty and totals remain accurate. Each page and its matching count are fetched in a single Prisma transaction. Missing users return 404 on their nested list routes.

| Endpoint | Sorting | Filters |
| --- | --- | --- |
| /users | createdAt (default), username, fullname | isPrivate, hasPosts (true/false); search across username OR fullname |
| /posts | createdAt (default), updatedAt, likes | location, caption search, from, to |

`order` is `desc` by default; `asc` is also allowed. Likes ties always use newest post first. User and caption searches are case-insensitive. Location is a case-insensitive exact match. Dates filter createdAt with inclusive `from` and exclusive `to`. All filters compose with sorting and pagination. Authored and liked-post lists always use newest post first. Invalid parameters return the lab's exact 400 messages.

```sh
curl 'localhost:3000/users?hasPosts=true&isPrivate=true'
curl 'localhost:3000/posts?location=GOA&sortBy=likes'
curl 'localhost:3000/posts?from=2026-03-01&to=2026-04-01'
curl 'localhost:3000/posts?search=tiger'
```

Use returned IDs in author, like, and nested-route requests; never hardcode seed IDs.

## Verification

`npm test` generates the client and runs the CRUD, Phase 2, and Phase 3 suites against isolated in-memory PostgreSQL-compatible databases. They apply every committed migration, check all supplied expected results, execute the standard seed commands three times, test simultaneous likes and nested-user privacy, and prove both user and post cascades. A final check verifies failed seeding is atomic. Your configured database is not modified by the automated suite.

See [VIVA.md](VIVA.md) for the relation and migration explanations.
