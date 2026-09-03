# Northstar campus portal

A responsive, local-first education portal prototype for administrators and students. It runs in a browser on Windows, Linux, macOS, iOS and Android through the same responsive web app.

## Run locally

```bash
cd frontend
npm install
npm start
```

In a second terminal, start the local SQLite API (optional for the browser-only demo):

```bash
cd backend
npm install
npm start
```

The API listens on `http://localhost:5000` and stores its SQLite database at
`backend/school_data/portal.sqlite`. It is deliberately local-only; no hosted
services, payment or funding integrations are included.

The app intentionally uses `localStorage`, so it works without a database or internet. Demo accounts:

| Role | Username | Password |
| --- | --- | --- |
| Main administrator | `mainadmin` | `ChangeMe123!` |
| Administrator | `admin` | `Admin123!` |
| Student | `student` | `Student123!` |

The sign-in screen includes a **Create an account** link for new students. Student registrations are saved in the browser for the standalone demo, while the backend also exposes SQLite-backed `POST /api/accounts/students` and `POST /api/accounts/sign-in` endpoints for local integration.

The main administrator can create/delete administrators and use **Design** to change the institution name, accent colour, background colour, text colour and portal font. Administrators can publish any file type as an assignment and edit result feedback. Students can view/download assignment entries and see their published results. Local browser storage is for demonstration only; uploaded binary files are represented by their metadata until a server storage API is connected.

## Folder guide

- `frontend/` — React single-page portal, styling and browser-local account/content state.
- `backend/` — Express local API, upload handling and SQLite database helpers.
- `backend/school_data/` — runtime-only database and uploaded files (created automatically; do not commit its contents).

## Production architecture

For a real deployment, move authentication and authorization to the backend. Store users, assignments, submissions and results in MySQL or PostgreSQL; store file bytes in S3-compatible object storage (or a protected filesystem), and store only metadata/keys in SQL. Hash passwords with Argon2 or bcrypt, use secure HTTP-only sessions, validate CSV columns and file size/type, and enforce role checks on every API route. Never ship the demo passwords or encryption key to production.

Example PostgreSQL starting point:

```sql
CREATE TABLE users (id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('main-admin','admin','student')));
CREATE TABLE assignments (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL,
  subject TEXT NOT NULL, due_at DATE NOT NULL, object_key TEXT NOT NULL, created_by BIGINT REFERENCES users(id));
CREATE TABLE results (id BIGSERIAL PRIMARY KEY, student_id BIGINT REFERENCES users(id),
  subject TEXT NOT NULL, score NUMERIC(5,2), grade TEXT, feedback TEXT);
```

The same tables work in MySQL after replacing `BIGSERIAL` with `BIGINT AUTO_INCREMENT`. Add migrations, backups, TLS, virus scanning and audit logs before handling real student data. Deploy the React build (`npm run build`) behind a reverse proxy and configure the API URL with an environment variable.
