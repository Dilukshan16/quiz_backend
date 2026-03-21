const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');

// POST /api/sessions/start - Start a new quiz attempt/session
const startQuiz = (req, res) => {
  try {
    const db = getDb();
    const { quiz_id, user_id } = req.body;

    if (!quiz_id) return res.status(400).json({ success: false, message: 'quiz_id is required' });

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND is_active = 1').get(quiz_id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const totalQuestions = db.prepare('SELECT COUNT(*) as count FROM questions WHERE quiz_id = ?').get(quiz_id).count;
    if (totalQuestions === 0) return res.status(400).json({ success: false, message: 'This quiz has no questions' });

    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO quiz_attempts (id, quiz_id, user_id, current_question_index, score, correct_answers, incorrect_answers, total_questions, is_completed)
      VALUES (?, ?, ?, 0, 0, 0, 0, ?, 0)
    `).run(attemptId, quiz_id, user_id || null, totalQuestions);

    // Fetch the first question
    const firstQuestion = getQuestionAtIndex(db, quiz_id, 0);

    res.status(201).json({
      success: true,
      message: 'Quiz started!',
      data: {
        attempt_id: attemptId,
        quiz_id,
        quiz_title: quiz.title,
        total_questions: totalQuestions,
        current_question_index: 0,
        progress_percentage: 0,
        score: 0,
        current_question: firstQuestion
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to start quiz', error: err.message });
  }
};

// GET /api/sessions/:attemptId - Get current session state
const getSession = (req, res) => {
  try {
    const db = getDb();
    const { attemptId } = req.params;

    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Session not found' });

    const currentQuestion = getQuestionAtIndex(db, attempt.quiz_id, attempt.current_question_index);
    const answeredQuestionIds = db.prepare(
      'SELECT question_id FROM quiz_attempt_answers WHERE attempt_id = ?'
    ).all(attemptId).map(r => r.question_id);

    res.json({
      success: true,
      data: {
        attempt_id: attemptId,
        quiz_id: attempt.quiz_id,
        current_question_index: attempt.current_question_index,
        total_questions: attempt.total_questions,
        score: attempt.score,
        correct_answers: attempt.correct_answers,
        incorrect_answers: attempt.incorrect_answers,
        completed_count: answeredQuestionIds.length,
        remaining_count: attempt.total_questions - answeredQuestionIds.length,
        progress_percentage: Math.round((answeredQuestionIds.length / attempt.total_questions) * 100),
        is_completed: attempt.is_completed === 1,
        current_question: attempt.is_completed ? null : currentQuestion
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get session', error: err.message });
  }
};

// POST /api/sessions/:attemptId/answer - Submit an answer
const submitAnswer = (req, res) => {
  try {
    const db = getDb();
    const { attemptId } = req.params;
    const { question_id, selected_option_id } = req.body;

    if (!question_id || !selected_option_id) {
      return res.status(400).json({ success: false, message: 'question_id and selected_option_id are required' });
    }

    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Session not found' });
    if (attempt.is_completed) return res.status(400).json({ success: false, message: 'Quiz already completed' });

    // Check if already answered
    const existingAnswer = db.prepare(
      'SELECT * FROM quiz_attempt_answers WHERE attempt_id = ? AND question_id = ?'
    ).get(attemptId, question_id);
    if (existingAnswer) return res.status(400).json({ success: false, message: 'Question already answered' });

    // Validate the selected option
    const selectedOption = db.prepare('SELECT * FROM options WHERE id = ? AND question_id = ?').get(selected_option_id, question_id);
    if (!selectedOption) return res.status(400).json({ success: false, message: 'Invalid option selected' });

    const isCorrect = selectedOption.is_correct === 1;
    const correctOption = db.prepare('SELECT * FROM options WHERE question_id = ? AND is_correct = 1').get(question_id);
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(question_id);

    // Save the answer
    db.prepare(`
      INSERT INTO quiz_attempt_answers (id, attempt_id, question_id, selected_option_id, is_correct)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), attemptId, question_id, selected_option_id, isCorrect ? 1 : 0);

    // Update score and counts
    const newScore = isCorrect ? attempt.score + 10 : attempt.score;
    const newCorrect = isCorrect ? attempt.correct_answers + 1 : attempt.correct_answers;
    const newIncorrect = !isCorrect ? attempt.incorrect_answers + 1 : attempt.incorrect_answers;

    db.prepare(`
      UPDATE quiz_attempts SET score = ?, correct_answers = ?, incorrect_answers = ? WHERE id = ?
    `).run(newScore, newCorrect, newIncorrect, attemptId);

    const answeredCount = db.prepare('SELECT COUNT(*) as count FROM quiz_attempt_answers WHERE attempt_id = ?').get(attemptId).count;
    const progressPercentage = Math.round((answeredCount / attempt.total_questions) * 100);

    res.json({
      success: true,
      data: {
        is_correct: isCorrect,
        correct_option_id: correctOption.id,
        correct_option_text: correctOption.option_text,
        explanation: question.explanation || null,
        feedback_message: isCorrect ? '🎉 Great job! That\'s correct!' : '😊 Not quite! Keep going!',
        score: newScore,
        correct_answers: newCorrect,
        incorrect_answers: newIncorrect,
        progress_percentage: progressPercentage,
        answered_count: answeredCount,
        remaining_count: attempt.total_questions - answeredCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit answer', error: err.message });
  }
};

// POST /api/sessions/:attemptId/next - Move to next question
const nextQuestion = (req, res) => {
  try {
    const db = getDb();
    const { attemptId } = req.params;

    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Session not found' });
    if (attempt.is_completed) return res.status(400).json({ success: false, message: 'Quiz already completed' });

    const nextIndex = attempt.current_question_index + 1;

    if (nextIndex >= attempt.total_questions) {
      // Complete the quiz
      db.prepare(`
        UPDATE quiz_attempts SET is_completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(attemptId);

      return res.json({
        success: true,
        is_finished: true,
        message: 'Quiz completed! 🎉',
        data: { attempt_id: attemptId, redirect_to: 'results' }
      });
    }

    db.prepare('UPDATE quiz_attempts SET current_question_index = ? WHERE id = ?').run(nextIndex, attemptId);

    const nextQuestion = getQuestionAtIndex(db, attempt.quiz_id, nextIndex);
    const answeredCount = db.prepare('SELECT COUNT(*) as count FROM quiz_attempt_answers WHERE attempt_id = ?').get(attemptId).count;

    res.json({
      success: true,
      is_finished: false,
      data: {
        current_question_index: nextIndex,
        total_questions: attempt.total_questions,
        current_question: nextQuestion,
        progress_percentage: Math.round((answeredCount / attempt.total_questions) * 100),
        score: attempt.score
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to navigate', error: err.message });
  }
};

// POST /api/sessions/:attemptId/prev - Move to previous question
const prevQuestion = (req, res) => {
  try {
    const db = getDb();
    const { attemptId } = req.params;

    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Session not found' });

    const prevIndex = attempt.current_question_index - 1;
    if (prevIndex < 0) return res.status(400).json({ success: false, message: 'Already at first question' });

    db.prepare('UPDATE quiz_attempts SET current_question_index = ? WHERE id = ?').run(prevIndex, attemptId);

    const previousQuestion = getQuestionAtIndex(db, attempt.quiz_id, prevIndex);
    const prevAnswer = db.prepare(
      'SELECT qaa.*, o.option_text FROM quiz_attempt_answers qaa JOIN options o ON qaa.selected_option_id = o.id WHERE qaa.attempt_id = ? AND qaa.question_id = ?'
    ).get(attemptId, previousQuestion.id);

    res.json({
      success: true,
      data: {
        current_question_index: prevIndex,
        total_questions: attempt.total_questions,
        current_question: previousQuestion,
        previously_selected_option: prevAnswer ? {
          option_id: prevAnswer.selected_option_id,
          option_text: prevAnswer.option_text,
          was_correct: prevAnswer.is_correct === 1
        } : null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to navigate', error: err.message });
  }
};

// GET /api/sessions/:attemptId/results - Get final results
const getResults = (req, res) => {
  try {
    const db = getDb();
    const { attemptId } = req.params;

    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Session not found' });

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id);
    const completionPercentage = Math.round((attempt.correct_answers / attempt.total_questions) * 100);

    // Determine stars and badge
    let stars = 1, badge = '🌟 Participant', encouragingMessage = '';
    if (completionPercentage === 100) {
      stars = 3; badge = '🏆 Quiz Master'; encouragingMessage = 'Perfect score! You are amazing! 🎉';
    } else if (completionPercentage >= 70) {
      stars = 2; badge = '⭐ Star Performer'; encouragingMessage = 'Great job! You did really well! 🌟';
    } else {
      stars = 1; badge = '🌟 Participant'; encouragingMessage = 'Good try! Practice makes perfect! 💪';
    }

    // Build detailed answer review
    const answers = db.prepare(`
      SELECT qaa.question_id, qaa.selected_option_id, qaa.is_correct,
             q.question_text, o.option_text as selected_option_text,
             co.option_text as correct_option_text, co.id as correct_option_id,
             q.explanation
      FROM quiz_attempt_answers qaa
      JOIN questions q ON qaa.question_id = q.id
      JOIN options o ON qaa.selected_option_id = o.id
      JOIN options co ON co.question_id = q.id AND co.is_correct = 1
      WHERE qaa.attempt_id = ?
      ORDER BY q.order_index ASC
    `).all(attemptId);

    res.json({
      success: true,
      data: {
        attempt_id: attemptId,
        quiz_title: quiz.title,
        total_questions: attempt.total_questions,
        correct_answers: attempt.correct_answers,
        incorrect_answers: attempt.incorrect_answers,
        score: attempt.score,
        completion_percentage: completionPercentage,
        stars,
        badge,
        encouraging_message: encouragingMessage,
        time_taken_seconds: attempt.completed_at
          ? Math.round((new Date(attempt.completed_at) - new Date(attempt.started_at)) / 1000)
          : null,
        answer_review: answers
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get results', error: err.message });
  }
};

// Helper function to get question at specific index
function getQuestionAtIndex(db, quizId, index) {
  const question = db.prepare(
    'SELECT id, question_text, explanation, image_url, order_index FROM questions WHERE quiz_id = ? ORDER BY order_index ASC LIMIT 1 OFFSET ?'
  ).get(quizId, index);

  if (!question) return null;

  const options = db.prepare(
    'SELECT id, option_text, order_index FROM options WHERE question_id = ? ORDER BY order_index ASC'
  ).all(question.id);

  return { ...question, options };
}

module.exports = { startQuiz, getSession, submitAnswer, nextQuestion, prevQuestion, getResults };