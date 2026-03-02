Intern Exam Portal

A full-stack web application designed to conduct online assessments for interns.
It provides an Admin Panel to manage exams and candidates, and a Candidate Portal to attend assessments and view results.

🚀 Tech Stack
Backend

Python

FastAPI

SQLAlchemy

SQLite

JWT Authentication

Excel Parsing (MCQ Upload)

Email Utility

Frontend

React (Vite)

Axios

CSS Modules

📂 Project Structure
Intern_Exam_Portal/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── auth.py
│   ├── routes/
│   │   ├── admin.py
│   │   └── candidate.py
│   ├── utils/
│   │   ├── crypto.py
│   │   ├── email_sender.py
│   │   ├── excel_parser.py
│   │   └── grading.py
│   ├── assessment.db
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/admin/
│   │   ├── pages/candidate/
│   │   ├── components/
│   │   └── api.js
│   └── package.json
│
├── sample_mcqs.xlsx
├── generate_sample_excel.py
├── start_backend.bat
├── start_frontend.bat
└── start.bat
🔐 Features
👨‍💼 Admin Features

Admin Login (JWT based authentication)

Manage Admins

Create Assessments

Upload MCQs via Excel file

Generate Candidate Test Links

View Candidate Details

Auto Grading System

Grading Dashboard

👨‍🎓 Candidate Features

Access test using generated link

Attempt MCQ-based assessment

Submit answers

View results instantly

⚙️ Backend Setup
1️⃣ Navigate to backend folder
cd backend
2️⃣ Create Virtual Environment (Recommended)
python -m venv venv
venv\Scripts\activate   # Windows
3️⃣ Install Dependencies
pip install -r requirements.txt
4️⃣ Configure Environment

Edit .env file inside backend folder:

SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
5️⃣ Run Backend Server
uvicorn main:app --reload

Backend runs at:

http://127.0.0.1:8000

Swagger Docs:

http://127.0.0.1:8000/docs
💻 Frontend Setup
1️⃣ Navigate to frontend folder
cd frontend
2️⃣ Install Dependencies
npm install
3️⃣ Run Frontend
npm run dev

Frontend runs at:

http://localhost:5173
▶️ Quick Start (Windows)

You can use the provided batch files:

start_backend.bat

start_frontend.bat

start.bat (to start both)

📊 MCQ Upload Format

Use the provided:

sample_mcqs.xlsx

Or generate a sample file:

python generate_sample_excel.py
Expected Excel Columns

| Question | Option A | Option B | Option C | Option D | Correct Answer |

Correct Answer must match one of the options exactly.

🗄 Database

Uses SQLite (assessment.db)

Automatically created when backend runs

SQLAlchemy ORM models defined in models.py

🔒 Authentication

JWT-based authentication

Admin login required for all protected routes

Tokens stored and sent via Authorization header

🧠 Grading System

Automatic evaluation of MCQs

Score calculation logic in:

backend/utils/grading.py

Result stored in database

📡 API Modules
Admin Routes

Create Assessment

Upload Questions

Generate Test Link

View Results

Manage Admins

Candidate Routes

Start Test

Submit Answers

View Result

🛠 Utilities
File	Purpose
crypto.py	Password hashing
email_sender.py	Send emails
excel_parser.py	Parse MCQ Excel files
grading.py	Auto scoring logic
🔮 Future Improvements

Timer-based exam

Randomized question order

Negative marking

Role-based access control

Email-based candidate verification

Production database (PostgreSQL)

Docker deployment
