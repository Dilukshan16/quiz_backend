// Simple validation middleware — no extra packages needed

const validateStartQuiz = (req, res, next) => {
  const { quiz_id } = req.body;
  if (!quiz_id || typeof quiz_id !== 'string') {
    return res.status(400).json({ success: false, message: 'quiz_id is required and must be a string' });
  }
  next();
};

const validateSubmitAnswer = (req, res, next) => {
  const { question_id, selected_option_id } = req.body;
  const errors = [];
  if (!question_id) errors.push('question_id is required');
  if (!selected_option_id) errors.push('selected_option_id is required');
  if (errors.length) return res.status(400).json({ success: false, message: errors.join(', ') });
  next();
};

const validateCreateQuiz = (req, res, next) => {
  const { title, questions } = req.body;
  const errors = [];

  if (!title || title.trim() === '') errors.push('title is required');
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    errors.push('questions array is required and must not be empty');
  } else {
    questions.forEach((q, i) => {
      if (!q.question_text) errors.push(`questions[${i}].question_text is required`);
      if (!q.options || q.options.length < 2) errors.push(`questions[${i}] must have at least 2 options`);
      else {
        const hasCorrect = q.options.some(o => o.is_correct === true);
        if (!hasCorrect) errors.push(`questions[${i}] must have at least one correct option`);
      }
    });
  }

  if (errors.length) return res.status(400).json({ success: false, message: 'Validation failed', errors });
  next();
};

const validateCreateUser = (req, res, next) => {
  const { name, age } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, message: 'name is required' });
  }
  if (age !== undefined && (isNaN(Number(age)) || Number(age) < 1 || Number(age) > 18)) {
    return res.status(400).json({ success: false, message: 'age must be a number between 1 and 18' });
  }
  next();
};

module.exports = { validateStartQuiz, validateSubmitAnswer, validateCreateQuiz, validateCreateUser };
