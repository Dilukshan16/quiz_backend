const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');

// GET /api/admin/stats - Overall system statistics
const getStats = (req, res) => {
  try {
    const db = getDb();

    const totalQuizzes    = db.prepare('SELECT COUNT(*) as count FROM quizzes WHERE is_active = 1').get().count;
    const totalQuestions  = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
    const totalAttempts   = db.prepare('SELECT COUNT(*) as count FROM quiz_attempts').get().count;
    const completedAttempts = db.prepare('SELECT COUNT(*) as count FROM quiz_attempts WHERE is_completed = 1').get().count;
    const totalUsers      = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    const popularQuizzes = db.prepare(`
      SELECT q.id, q.title, q.category, q.difficulty,
             COUNT(qa.id) as attempt_count,
             ROUND(AVG(CAST(qa.correct_answers AS FLOAT) / qa.total_questions * 100), 1) as avg_score_pct
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.is_completed = 1
      WHERE q.is_active = 1
      GROUP BY q.id
      ORDER BY attempt_count DESC
      LIMIT 5
    `).all();

    res.json({
      success: true,
      data: {
        total_quizzes: totalQuizzes,
        total_questions: totalQuestions,
        total_users: totalUsers,
        total_attempts: totalAttempts,
        completed_attempts: completedAttempts,
        completion_rate: totalAttempts
          ? Math.round((completedAttempts / totalAttempts) * 100) + '%'
          : '0%',
        popular_quizzes: popularQuizzes
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get stats', error: err.message });
  }
};

// GET /api/admin/quizzes - Get all quizzes with full details including questions
const getAllQuizzesAdmin = (req, res) => {
  try {
    const db = getDb();
    const quizzes = db.prepare('SELECT * FROM quizzes ORDER BY created_at DESC').all();

    const fullQuizzes = quizzes.map(quiz => {
      const questions = db.prepare(
        'SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC'
      ).all(quiz.id);

      const questionsWithOptions = questions.map(q => {
        const options = db.prepare(
          'SELECT * FROM options WHERE question_id = ? ORDER BY order_index ASC'
        ).all(q.id);
        return { ...q, options };
      });

      return { ...quiz, questions: questionsWithOptions };
    });

    res.json({ success: true, data: fullQuizzes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get quizzes', error: err.message });
  }
};

// PUT /api/admin/quizzes/:id - Update quiz metadata
const updateQuiz = (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { title, description, category, difficulty, image_url, is_active } = req.body;

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    db.prepare(`
      UPDATE quizzes
      SET title = ?, description = ?, category = ?, difficulty = ?, image_url = ?, is_active = ?
      WHERE id = ?
    `).run(
      title       ?? quiz.title,
      description ?? quiz.description,
      category    ?? quiz.category,
      difficulty  ?? quiz.difficulty,
      image_url   ?? quiz.image_url,
      is_active   !== undefined ? (is_active ? 1 : 0) : quiz.is_active,
      id
    );

    const updated = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id);
    res.json({ success: true, message: 'Quiz updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update quiz', error: err.message });
  }
};

// PUT /api/admin/questions/:id - Update a single question
const updateQuestion = (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { question_text, explanation, image_url } = req.body;

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

    db.prepare(`
      UPDATE questions SET question_text = ?, explanation = ?, image_url = ? WHERE id = ?
    `).run(
      question_text ?? question.question_text,
      explanation   ?? question.explanation,
      image_url     ?? question.image_url,
      id
    );

    res.json({ success: true, message: 'Question updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update question', error: err.message });
  }
};

// POST /api/admin/questions/:questionId/options - Add a new option to a question
const addOption = (req, res) => {
  try {
    const db = getDb();
    const { questionId } = req.params;
    const { option_text, is_correct } = req.body;

    if (!option_text) return res.status(400).json({ success: false, message: 'option_text is required' });

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

    const maxOrder = db.prepare('SELECT MAX(order_index) as max FROM options WHERE question_id = ?').get(questionId).max ?? -1;

    // If marking this as correct, unset previous correct option
    if (is_correct) {
      db.prepare('UPDATE options SET is_correct = 0 WHERE question_id = ?').run(questionId);
    }

    const optionId = uuidv4();
    db.prepare('INSERT INTO options (id, question_id, option_text, is_correct, order_index) VALUES (?, ?, ?, ?, ?)').run(
      optionId, questionId, option_text, is_correct ? 1 : 0, maxOrder + 1
    );

    res.status(201).json({ success: true, message: 'Option added', data: { id: optionId } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add option', error: err.message });
  }
};

// GET /api/admin/attempts - View all quiz attempts with details
const getAllAttempts = (req, res) => {
  try {
    const db = getDb();
    const { quiz_id, completed } = req.query;

    let query = `
      SELECT qa.*, q.title as quiz_title, u.name as user_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      LEFT JOIN users u ON qa.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (quiz_id) { query += ' AND qa.quiz_id = ?'; params.push(quiz_id); }
    if (completed !== undefined) { query += ' AND qa.is_completed = ?'; params.push(completed === 'true' ? 1 : 0); }

    query += ' ORDER BY qa.started_at DESC LIMIT 100';
    const attempts = db.prepare(query).all(...params);

    res.json({ success: true, data: attempts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get attempts', error: err.message });
  }
};

module.exports = { getStats, getAllQuizzesAdmin, updateQuiz, updateQuestion, addOption, getAllAttempts };
