const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_PATH = path.resolve(process.env.DB_PATH || './quiz.db');

let _rawDb = null;
let db = null;

function persistDb() {
  const data = _rawDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    _rawDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _rawDb = new SQL.Database();
  }
  initializeSchema();
  db = wrapDb(_rawDb);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Ensure initDb() was awaited in server startup.');
  return db;
}

function wrapDb(sqlDb) {
  let inTransaction = false;

  const prepare = (sql) => ({
    run: (...params) => {
      sqlDb.run(sql, params);
      if (!inTransaction) persistDb();
    },
    get: (...params) => {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all: (...params) => {
      const rows = [];
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }
  });

  return {
    prepare,
    exec: (sql) => { sqlDb.exec(sql); persistDb(); },
    run: (sql, params = []) => {
      sqlDb.run(sql, params);
      if (!inTransaction) persistDb();
    },
    transaction: (fn) => () => {
      inTransaction = true;
      sqlDb.run('BEGIN');
      try {
        fn();
        sqlDb.run('COMMIT');
        persistDb();
      } catch (err) {
        try { sqlDb.run('ROLLBACK'); } catch (_) {}
        throw err;
      } finally {
        inTransaction = false;
      }
    }
  };
}

function initializeSchema() {
  _rawDb.run('PRAGMA foreign_keys = ON');
  [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      category TEXT, difficulty TEXT DEFAULT 'easy', total_questions INTEGER DEFAULT 0,
      image_url TEXT, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, question_text TEXT NOT NULL,
      explanation TEXT, image_url TEXT, order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id))`,
    `CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY, question_id TEXT NOT NULL, option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0, order_index INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id))`,
    `CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, user_id TEXT,
      current_question_index INTEGER DEFAULT 0, score INTEGER DEFAULT 0,
      correct_answers INTEGER DEFAULT 0, incorrect_answers INTEGER DEFAULT 0,
      total_questions INTEGER NOT NULL, is_completed INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id))`,
    `CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
      id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, question_id TEXT NOT NULL,
      selected_option_id TEXT, is_correct INTEGER DEFAULT 0,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id),
      FOREIGN KEY (question_id) REFERENCES questions(id))`
  ].forEach(sql => _rawDb.run(sql));
  persistDb();
}

module.exports = { initDb, getDb };