const { getDb } = require('../models/database');

// GET /api/progress/:attemptId - Get detailed progress for frontend progress bar
const getProgress = (req, res) => {
  try {
    const db = getDb();
    const { attemptId } = req.params;

    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Session not found' });

    const answeredCount = db.prepare(
      'SELECT COUNT(*) as count FROM quiz_attempt_answers WHERE attempt_id = ?'
    ).get(attemptId).count;

    const remainingCount = attempt.total_questions - answeredCount;
    const progressPercentage = Math.round((answeredCount / attempt.total_questions) * 100);

    res.json({
      success: true,
      data: {
        attempt_id: attemptId,
        total_questions: attempt.total_questions,
        completed_count: answeredCount,
        remaining_count: remainingCount,
        current_question_index: attempt.current_question_index,
        progress_percentage: progressPercentage,
        score: attempt.score,
        correct_answers: attempt.correct_answers,
        incorrect_answers: attempt.incorrect_answers,
        is_completed: attempt.is_completed === 1
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get progress', error: err.message });
  }
};

module.exports = { getProgress };