const express = require('express');
const router = express.Router();
const {
  getStats,
  getAllQuizzesAdmin,
  updateQuiz,
  updateQuestion,
  addOption,
  getAllAttempts
} = require('../controllers/adminController');

router.get('/stats', getStats);
router.get('/quizzes', getAllQuizzesAdmin);
router.put('/quizzes/:id', updateQuiz);
router.put('/questions/:id', updateQuestion);
router.post('/questions/:questionId/options', addOption);
router.get('/attempts', getAllAttempts);

module.exports = router;