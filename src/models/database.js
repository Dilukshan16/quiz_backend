const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './quiz.db';

let db;

function getDb() {
  if (!db) {
    db = new Database(path.resolve(DB_PATH));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    -- Users / Children table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Quizzes table
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      difficulty TEXT DEFAULT 'easy',
      total_questions INTEGER DEFAULT 0,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Questions table
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      explanation TEXT,
      image_url TEXT,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    -- Options (Answer choices) table
    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    -- Quiz Attempts (Sessions) table
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      user_id TEXT,
      current_question_index INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      correct_answers INTEGER DEFAULT 0,
      incorrect_answers INTEGER DEFAULT 0,
      total_questions INTEGER NOT NULL,
      is_completed INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Quiz Attempt Answers table
    CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      selected_option_id TEXT,
      is_correct INTEGER DEFAULT 0,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (selected_option_id) REFERENCES options(id)
    );
  `);
}

module.exports = { getDb };