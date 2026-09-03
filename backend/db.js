const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATA_ROOT = path.resolve(__dirname, 'school_data');
fs.mkdirSync(DATA_ROOT, { recursive: true });

const db = new sqlite3.Database(path.join(DATA_ROOT, 'portal.sqlite'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        student_id TEXT,
        role TEXT NOT NULL CHECK (role IN ('main-admin', 'admin', 'student')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
});

function createStudent({ name, username, password, studentId }) {
    return new Promise((resolve, reject) => {
        const statement = db.prepare('INSERT INTO users (name, username, password, student_id, role) VALUES (?, ?, ?, ?, ?)');
        statement.run(name, username, password, studentId, 'student', function onInsert(error) {
            statement.finalize();
            if (error) return reject(error);
            resolve({ id: this.lastID, name, username, studentId, role: 'student' });
        });
    });
}

function findUser(username, password) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, name, username, student_id AS studentId, role FROM users WHERE username = ? AND password = ?', [username, password], (error, row) => {
            if (error) return reject(error);
            resolve(row || null);
        });
    });
}

module.exports = { createStudent, findUser };
