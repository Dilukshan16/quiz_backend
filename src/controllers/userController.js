const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');

// POST /api/users - Register a new child user
const createUser = (req, res) => {
  try {
    const db = getDb();
    const { name, age } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (age !== undefined && (isNaN(age) || age < 1 || age > 18)) {
      return res.status(400).json({ success: false, message: 'Age must be between 1 and 18' });
    }

    const userId = uuidv4();
    db.prepare('INSERT INTO users (id, name, age) VALUES (?, ?, ?)').run(userId, name.trim(), age || null);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({ success: true, message: 'User created!', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create user', error: err.message });
  }
};

// GET /api/users/:id - Get a user profile + their quiz history
const getUserById = (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const attempts = db.prepare(`
      SELECT qa.id as attempt_id, qa.score, qa.correct_answers, qa.total_questions,
             qa.is_completed, qa.started_at, qa.completed_at,
             q.title as quiz_title, q.category, q.difficulty
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.user_id = ?
      ORDER BY qa.started_at DESC
    `).all(id);

    const completedAttempts = attempts.filter(a => a.is_completed === 1);
    const totalScore = completedAttempts.reduce((sum, a) => sum + a.score, 0);
    const avgScore = completedAttempts.length
      ? Math.round(completedAttempts.reduce((sum, a) => sum + Math.round((a.correct_answers / a.total_questions) * 100), 0) / completedAttempts.length)
      : 0;

    res.json({
      success: true,
      data: {
        ...user,
        stats: {
          total_attempts: attempts.length,
          completed_quizzes: completedAttempts.length,
          total_score: totalScore,
          average_percentage: avgScore
        },
        quiz_history: attempts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get user', error: err.message });
  }
};

// GET /api/users - Get all users (admin use)
const getAllUsers = (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get users', error: err.message });
  }
};

module.exports = { createUser, getUserById, getAllUsers };
