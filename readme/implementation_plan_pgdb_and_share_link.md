# NexOS Enterprise Upgrade: PostgreSQL & Secure File Sharing Links

Migrating the underlying architecture to PostgreSQL enables high-currency multi-user read/writes while adding robust file sharing capabilities, aligning NexOS fully with enterprise Cloud solutions.

## User Review Required

> [!WARNING]
> **Database Migration:** 
> Moving from SQLite to PostgreSQL means data stored in the current SQLite database will not automatically transfer over to the new PostgreSQL container unless a complex data migrator is written. For this implementation, we will reset the database structure on the new PostgreSQL instance but keep the existing file contents intact in the `cloud_data/` directory. You will need to log in and re-upload metadata, or we can write a specific SQLite-to-Postgres transfer script. **Please confirm if you are okay with starting fresh on the database side (default admin/user accounts will be recreated).**

## Proposed Changes

---

### Backend Components

#### [MODIFY] [docker-compose.yml](file:///d:/Web%20Os/docker-compose.yml)
- Complete rewrite to orchestrate a multi-container stack.
- Include `postgres:15-alpine` image.
- Set up a Docker network for internal communication between NexOS backend and PostgreSQL.
- Add `DATABASE_URL` environment variables to the `nexos-backend` service.

#### [MODIFY] [package.json](file:///d:/Web%20Os/package.json)
- Remove `sqlite3` and `sqlite`.
- Add `pg` (node-postgres) driver for handling PostgreSQL operations.

#### [MODIFY] [database.js](file:///d:/Web%20Os/database.js)
- Instantiate a `pg.Pool` connected via `DATABASE_URL`.
- Auto-provision Postgres Tables: `users`, `metadata`, and a new `shared_links` table.
- Build a query wrapper (`get`, `all`, `run`) that translates SQLite parameterized query syntax `?` into PostgreSQL parameter syntax `$1, $2` to minimize disruptions in `server.js`.

#### [MODIFY] [server.js](file:///d:/Web%20Os/server.js)
- Add API Endpoint `POST /api/cloud/share` to generate a secure UUID link linking to a specific file.
- Add API Endpoint `GET /api/cloud/share/:linkId` to process the UUID mapping and stream the downloaded file payload without requiring a JWT token (simulating a public link).

---

### Frontend Components

#### [MODIFY] [js/apps/cloud-drive.js](file:///d:/Web%20Os/js/apps/cloud-drive.js)
- Add "🔗 Get Share Link" to the file right-click Context Menu.
- Create an API call to `POST /api/cloud/share`.
- Use the `Dialog` or `Notifications` API to display the generated link to the user and auto-copy it to their clipboard.

## Open Questions

> [!IMPORTANT]
> 1. Do you have any existing data in the SQLite database that you **must** keep, or is it okay to start with a fresh PostgreSQL database (with standard 'admin' and 'user' accounts recreated)? 
> 2. By default, secure share links will be public to anyone who posesses the link. Should we add an expiration time to these links (e.g., 24 hours), or keep them permanent until the user explicitly revokes them?

## Verification Plan

### Automated Tests
- Run `docker compose down -v` and `docker compose up -d --build` to launch the PostgreSQL and backend stack.
- View container logs to ensure PostgreSQL initialization is successful and the node app connects.
- Use `curl` to generate a share link as a logged-in user.
- Use `curl` in a private session (no Auth headers) to download the file using the retrieved link.

### Manual Verification
- Log in to NexOS via a web browser.
- Open Cloud Drive, right-click a file, and click "Get Share Link".
- Paste the generated URL into a new Incognito browser tab.
- Confirm that the file downloads successfully over the network without requiring a NexOS account.
