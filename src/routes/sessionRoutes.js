const express = require('express');
const router = express.Router();
const {
  startQuiz,
  getSession,
  submitAnswer,
  nextQuestion,
  prevQuestion,
  getResults
} = require('../controllers/sessionController');
const { validateStartQuiz, validateSubmitAnswer } = require('../middleware/validation');

router.post('/start', validateStartQuiz, startQuiz);
router.get('/:attemptId', getSession);
router.post('/:attemptId/answer', validateSubmitAnswer, submitAnswer);
router.post('/:attemptId/next', nextQuestion);
router.post('/:attemptId/prev', prevQuestion);
router.get('/:attemptId/results', getResults);

module.exports = router;