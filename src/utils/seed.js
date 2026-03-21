const { v4: uuidv4 } = require('uuid');
const { initDb, getDb } = require('../models/database');

const seedData = async () => {
  await initDb();
  const db = getDb();

  const existing = db.prepare('SELECT COUNT(*) as count FROM quizzes').get();
  if (existing.count > 0) {
    console.log('Already has data. Skipping seed.');
    return;
  }

  const quizId = uuidv4();

  const questions = [
    {
      text: 'What is 2 + 2?',
      explanation: 'When you add 2 apples and 2 apples, you get 4 apples!',
      options: [
        { text: '3', correct: false },
        { text: '4', correct: true },
        { text: '5', correct: false },
        { text: '6', correct: false }
      ]
    },
    {
      text: 'What color is the sky on a clear day?',
      explanation: 'The sky appears blue because of how sunlight scatters in the atmosphere.',
      options: [
        { text: 'Green', correct: false },
        { text: 'Red', correct: false },
        { text: 'Blue', correct: true },
        { text: 'Yellow', correct: false }
      ]
    },
    {
      text: 'How many legs does a spider have?',
      explanation: 'Spiders are arachnids and have 8 legs, unlike insects which have 6.',
      options: [
        { text: '6', correct: false },
        { text: '8', correct: true },
        { text: '10', correct: false },
        { text: '4', correct: false }
      ]
    },
    {
      text: 'Which animal is known as the King of the Jungle?',
      explanation: 'The lion is called the King of the Jungle because of its strength and majesty!',
      options: [
        { text: 'Tiger', correct: false },
        { text: 'Elephant', correct: false },
        { text: 'Lion', correct: true },
        { text: 'Cheetah', correct: false }
      ]
    },
    {
      text: 'What is the largest planet in our solar system?',
      explanation: 'Jupiter is so big that more than 1,300 Earths could fit inside it!',
      options: [
        { text: 'Saturn', correct: false },
        { text: 'Mars', correct: false },
        { text: 'Earth', correct: false },
        { text: 'Jupiter', correct: true }
      ]
    }
  ];

  // All db.prepare() calls inside the transaction callback use the
  // outer db reference — inTransaction flag suppresses per-call persist
  const transaction = db.transaction(() => {
    db.prepare(
      'INSERT INTO quizzes (id, title, description, category, difficulty, total_questions) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(quizId, 'Fun Kids Quiz', 'A fun quiz for children covering basic topics!', 'general', 'easy', questions.length);

    questions.forEach((q, qIndex) => {
      const questionId = uuidv4();
      db.prepare(
        'INSERT INTO questions (id, quiz_id, question_text, explanation, order_index) VALUES (?, ?, ?, ?, ?)'
      ).run(questionId, quizId, q.text, q.explanation, qIndex);
      q.options.forEach((opt, oIndex) => {
        db.prepare(
          'INSERT INTO options (id, question_id, option_text, is_correct, order_index) VALUES (?, ?, ?, ?, ?)'
        ).run(uuidv4(), questionId, opt.text, opt.correct ? 1 : 0, oIndex);
      });
    });
  });

  transaction();
  console.log('Seed data inserted successfully!');
  console.log('Quiz ID: ' + quizId);
};

seedData().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });