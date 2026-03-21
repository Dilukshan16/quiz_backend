# quiz_backend

### Install dependencies
```bash
npm install
```

### Load sample quiz data
```bash
npm run seed
```

### Start the server
```bash
npm run dev
```

## 🌐 API Endpoints
 
### Quiz Endpoints
 
| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/quizzes` | Get all quizzes |
| GET | `/api/quizzes/:id` | Get one quiz with all questions |
| POST | `/api/quizzes` | Create a new quiz |
| DELETE | `/api/quizzes/:id` | Delete a quiz |
 
### Session Endpoints (Quiz Flow)
 
| Method | URL | What it does |
|--------|-----|--------------|
| POST | `/api/sessions/start` | Start a quiz, get first question |
| GET | `/api/sessions/:attemptId` | Get current session state |
| POST | `/api/sessions/:attemptId/answer` | Submit an answer |
| POST | `/api/sessions/:attemptId/next` | Go to next question |
| POST | `/api/sessions/:attemptId/prev` | Go to previous question |
| GET | `/api/sessions/:attemptId/results` | Get final score + badge |
 
### Progress Endpoint
 
| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/progress/:attemptId` | Get progress % for progress bar |
 
---
