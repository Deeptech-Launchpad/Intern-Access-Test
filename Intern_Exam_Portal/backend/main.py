from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from database import engine, SessionLocal
import models
import auth
from routes import admin as admin_router
from routes import candidate as candidate_router

# Create all tables
models.Base.metadata.create_all(bind=engine)


def seed_admin():
    """Seed a default admin account if none exists."""
    db = SessionLocal()
    try:
        existing = db.query(models.Admin).filter(models.Admin.username == "admin").first()
        if not existing:
            hashed = auth.get_password_hash("admin123")
            db.add(models.Admin(username="admin", hashed_password=hashed))
            db.commit()
            print("[OK] Default admin created: admin / admin123")
        else:
            print("[INFO] Admin account already exists")
    except Exception as e:
        print(f"[ERROR] Seeding admin failed: {e}")
    finally:
        db.close()


def send_reminder_emails():
    """
    Runs every 30 minutes.
    Finds candidates whose token expires within 2 hours,
    has NOT expired yet, and has NO test session started.
    Sends them a reminder email.
    """
    from utils.email_sender import send_reminder_email
    from datetime import timezone

    db = SessionLocal()
    try:
        now      = datetime.utcnow()
        in_2hrs  = now + timedelta(hours=2)
        IST      = timezone(timedelta(hours=5, minutes=30))

        # Candidates whose link expires within 2 hours and hasn't expired yet
        candidates = (
            db.query(models.Candidate)
            .filter(
                models.Candidate.token_expiry > now,
                models.Candidate.token_expiry <= in_2hrs,
            )
            .all()
        )

        sent = 0
        for candidate in candidates:
            # Skip if they already have a test session (started or submitted)
            if candidate.session is not None:
                continue

            assessment = candidate.assessment
            job_position     = assessment.job_position if assessment else ""
            assessment_title = assessment.title if assessment else "InternAssess MCQ Test"

            import os
            FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
            test_link = f"{FRONTEND_URL}/test/{candidate.test_token}"

            expiry_ist = candidate.token_expiry.replace(
                tzinfo=timezone.utc
            ).astimezone(IST)
            expires_at_str = expiry_ist.strftime("%Y-%m-%d %I:%M %p")

            send_reminder_email(
                candidate_name=candidate.name,
                candidate_email=candidate.email,
                test_link=test_link,
                expires_at=expires_at_str,
                job_position=job_position,
                assessment_title=assessment_title,
            )
            sent += 1

        if sent:
            print(f"[SCHEDULER] Sent {sent} reminder email(s)")
        else:
            print(f"[SCHEDULER] No reminder emails needed at {now.strftime('%H:%M:%S')}")

    except Exception as e:
        print(f"[SCHEDULER ERROR] {e}")
    finally:
        db.close()


scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    seed_admin()
    scheduler.add_job(send_reminder_emails, "interval", minutes=30, id="reminder_job")
    scheduler.start()
    print("[OK] Reminder scheduler started — runs every 30 minutes")
    yield
    # Shutdown
    scheduler.shutdown(wait=False)
    print("[OK] Scheduler stopped")


app = FastAPI(
    title="Internship Assessment Portal API",
    description="Backend API for MCQ-based internship assessments",
    version="1.0.0",
    lifespan=lifespan,
)

import os

# CORS — allow frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
]
if os.getenv("FRONTEND_URL"):
    origins.append(os.getenv("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(admin_router.router)
app.include_router(candidate_router.router)


@app.get("/")
def root():
    return {"message": "Internship Assessment Portal API is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
