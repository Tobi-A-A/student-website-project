# Northstar campus portal

A responsive, local-first education portal prototype for administrators and students. It runs in a browser on Windows, Linux, macOS, iOS and Android through the same responsive web app.

## Run locally

```bash
cd frontend
npm install
npm start
```

The app intentionally uses `localStorage`, so it works without a database or internet. Demo accounts:

| Role | Username | Password |
| --- | --- | --- |
| Main administrator | `mainadmin` | `ChangeMe123!` |
| Administrator | `admin` | `Admin123!` |
| Student | `student` | `Student123!` |

The main administrator can create/delete administrators and change the institution name/accent colour. Administrators can publish any file type as an assignment and edit result feedback. Students can view/download assignment entries and see their published results. Local browser storage is for demonstration only; uploaded binary files are represented by their metadata until a server storage API is connected.

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
