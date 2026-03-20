const express = require('express');
const router = express.Router();
const { getAllQuizzes, getQuizById, createQuiz, deleteQuiz } = require('../controllers/quizController');
const { validateCreateQuiz } = require('../middleware/validation');

router.get('/', getAllQuizzes);
router.get('/:id', getQuizById);
router.post('/', validateCreateQuiz, createQuiz);
router.delete('/:id', deleteQuiz);

module.exports = router;