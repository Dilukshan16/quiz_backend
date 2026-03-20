require('dotenv').config();
const express = require('express');
const cors = require('cors');

const quizRoutes = require('./routes/quizRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const progressRoutes = require('./routes/progressRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🎉 Quiz Backend is running!',
    version: '1.0.0',
    endpoints: {
      quizzes: '/api/quizzes',
      sessions: '/api/sessions',
      progress: '/api/progress'
    }
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/quizzes', quizRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/progress', progressRoutes);

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Quiz Backend running on http://localhost:${PORT}`);
  console.log(`📖 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📌 Available Routes:`);
  console.log(`   GET  /api/quizzes              - List all quizzes`);
  console.log(`   GET  /api/quizzes/:id          - Get quiz details`);
  console.log(`   POST /api/quizzes              - Create a quiz`);
  console.log(`   POST /api/sessions/start       - Start quiz session`);
  console.log(`   GET  /api/sessions/:id         - Get session state`);
  console.log(`   POST /api/sessions/:id/answer  - Submit answer`);
  console.log(`   POST /api/sessions/:id/next    - Next question`);
  console.log(`   POST /api/sessions/:id/prev    - Previous question`);
  console.log(`   GET  /api/sessions/:id/results - Final results`);
  console.log(`   GET  /api/progress/:id         - Progress tracking\n`);
});

module.exports = app;
