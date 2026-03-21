const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');

// GET /api/quizzes - Get all active quizzes
const getAllQuizzes = (req, res) => {
  try {
    const db = getDb();
    const { category, difficulty } = req.query;

    let query = 'SELECT * FROM quizzes WHERE is_active = 1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (difficulty) {
      query += ' AND difficulty = ?';
      params.push(difficulty);
    }

    query += ' ORDER BY created_at DESC';
    const quizzes = db.prepare(query).all(...params);

    res.json({ success: true, data: quizzes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes', error: err.message });
  }
};

// GET /api/quizzes/:id - Get single quiz with all questions and options
const getQuizById = (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND is_active = 1').get(id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const questions = db.prepare(
      'SELECT id, quiz_id, question_text, explanation, image_url, order_index FROM questions WHERE quiz_id = ? ORDER BY order_index ASC'
    ).all(id);

    const questionsWithOptions = questions.map(q => {
      const options = db.prepare(
        'SELECT id, option_text, order_index FROM options WHERE question_id = ? ORDER BY order_index ASC'
      ).all(q.id);
      return { ...q, options };
    });

    res.json({ success: true, data: { ...quiz, questions: questionsWithOptions } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch quiz', error: err.message });
  }
};

// POST /api/quizzes - Create a new quiz with questions
const createQuiz = (req, res) => {
  try {
    const db = getDb();
    const { title, description, category, difficulty, image_url, questions } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Quiz title is required' });
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one question is required' });
    }

    const quizId = uuidv4();

    const transaction = db.transaction(() => {
      db.prepare(
        'INSERT INTO quizzes (id, title, description, category, difficulty, total_questions, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(quizId, title, description || null, category || null, difficulty || 'easy', questions.length, image_url || null);

      questions.forEach((q, qIndex) => {
        if (!q.question_text) throw new Error(`Question ${qIndex + 1} is missing question_text`);
        if (!q.options || q.options.length < 2) throw new Error(`Question ${qIndex + 1} needs at least 2 options`);

        const questionId = uuidv4();
        db.prepare(
          'INSERT INTO questions (id, quiz_id, question_text, explanation, image_url, order_index) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(questionId, quizId, q.question_text, q.explanation || null, q.image_url || null, qIndex);

        q.options.forEach((opt, oIndex) => {
          db.prepare(
            'INSERT INTO options (id, question_id, option_text, is_correct, order_index) VALUES (?, ?, ?, ?, ?)'
          ).run(uuidv4(), questionId, opt.option_text, opt.is_correct ? 1 : 0, oIndex);
        });
      });
    });

    transaction();

    const createdQuiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
    res.status(201).json({ success: true, message: 'Quiz created successfully', data: createdQuiz });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create quiz', error: err.message });
  }
};

// DELETE /api/quizzes/:id - Soft delete a quiz
const deleteQuiz = (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    db.prepare('UPDATE quizzes SET is_active = 0 WHERE id = ?').run(id);
    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete quiz', error: err.message });
  }
};

module.exports = { getAllQuizzes, getQuizById, createQuiz, deleteQuiz };