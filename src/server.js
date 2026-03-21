require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initDb } = require("./models/database");

const quizRoutes = require("./routes/quizRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const progressRoutes = require("./routes/progressRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🎉 Quiz Backend is running!",
    version: "1.0.0",
    endpoints: {
      quizzes: "/api/quizzes",
      sessions: "/api/sessions",
      progress: "/api/progress",
      users: "/api/users",
      admin: "/api/admin",
    },
  });
});

app.use("/api/quizzes", quizRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

// ── Boot: init DB first, then start listening ──────────────────
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Quiz Backend running on http://localhost:${PORT}`);
      console.log(`📖 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`\n📌 Available Routes:`);
      console.log(
        `   GET    /api/quizzes                     - List all quizzes`,
      );
      console.log(
        `   GET    /api/quizzes/:id                 - Get quiz details`,
      );
      console.log(`   POST   /api/quizzes                     - Create a quiz`);
      console.log(`   DELETE /api/quizzes/:id                 - Delete a quiz`);
      console.log(
        `   POST   /api/users                       - Register a child user`,
      );
      console.log(
        `   GET    /api/users/:id                   - Get user + quiz history`,
      );
      console.log(
        `   POST   /api/sessions/start              - Start quiz session`,
      );
      console.log(
        `   GET    /api/sessions/:id                - Get session state`,
      );
      console.log(`   POST   /api/sessions/:id/answer         - Submit answer`);
      console.log(`   POST   /api/sessions/:id/next           - Next question`);
      console.log(
        `   POST   /api/sessions/:id/prev           - Previous question`,
      );
      console.log(`   GET    /api/sessions/:id/results        - Final results`);
      console.log(
        `   GET    /api/progress/:id                - Progress tracking`,
      );
      console.log(`   GET    /api/admin/stats                 - System stats`);
      console.log(
        `   GET    /api/admin/quizzes               - All quizzes (admin)`,
      );
      console.log(`   PUT    /api/admin/quizzes/:id           - Edit quiz`);
      console.log(`   PUT    /api/admin/questions/:id         - Edit question`);
      console.log(
        `   GET    /api/admin/attempts              - View all attempts\n`,
      );
    });
  })
  .catch((err) => {
    console.error("❌ Failed to initialize database:", err.message);
    process.exit(1);
  });

module.exports = app;
